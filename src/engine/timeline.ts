// src/engine/timeline.ts
import type { LexicalEnvironment } from "./environment";

export interface ExpressionInfo {
  result: any;
  breakdown: string[];
  context?: string;
  friendly?: string[];
}

export interface NextStep {
  line: number | null;
  message: string;
}

export interface DiffSnapshot {
  added: Record<string, any>;
  changed: Record<string, { from: any; to: any }>;
  removed: Record<string, any>;
}

export interface StepMetadata {
  kind: "statement" | "call" | "return" | "closureCreated" | "closureCalled";
  functionName: string | null;
  scopeName: string | null;
  closureVariables: Record<string, any> | null;
}

export interface TimelineEntry {
  step: number;
  line: number;
  variables: Record<string, any>;
  heap: Record<string, any>;
  stack: string[];
  output: string[];
  expressionEval?: Record<string, ExpressionInfo>;
  controlFlow?: string[];
  nextStep?: NextStep;
  diff?: DiffSnapshot;
  meta: StepMetadata;
}

function isUserFunctionValue(value: any) {
  return value && typeof value === "object" && value.__isFunctionValue === true;
}

export class TimelineLogger {
  private entries: TimelineEntry[] = [];
  private step = 1;
  private output: string[] = [];
  private lastVars: Record<string, any> | null = null;

  constructor(
    private getEnvSnapshot: () => LexicalEnvironment,
    private getStack: () => string[],
    private code: string,
    private maxSteps: number = 5000
  ) {}

  getCode(): string {
    return this.code;
  }

  setCurrentEnv(env: LexicalEnvironment) {
    this.getEnvSnapshot = () => env;
  }

  // ---------------- Safe serialization ----------------
  private safeSerializeValue(val: any, seen = new WeakSet(), depth = 0): any {
    if (val === undefined) return undefined;
    if (val === null) return null;
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      return val;
    }
    if (typeof val === "function") return "[NativeFunction]";
    if (isUserFunctionValue(val)) return "[Function]";
    if (depth > 2) return "[Object]";
    if (Array.isArray(val)) return val.map(v => this.safeSerializeValue(v, seen, depth + 1));
    if (typeof val === "object") {
      if (seen.has(val)) return "[Circular]";
      seen.add(val);

      // Special-case Math
      if (val === (globalThis as any).Math) {
        const out: Record<string, any> = {};
        for (const prop of Object.getOwnPropertyNames(Math)) {
          const v = (Math as any)[prop];
          out[prop] = typeof v === "function" ? "[NativeFunction]" : v;
        }
        return out;
      }

      const proto = Object.getPrototypeOf(val);
      if (proto === Object.prototype || proto === null) {
        const out: Record<string, any> = {};
        for (const k of Object.keys(val)) {
          try {
            out[k] = this.safeSerializeValue((val as any)[k], seen, depth + 1);
          } catch {
            out[k] = "[ErrorReading]";
          }
        }
        return out;
      }

      const summary: Record<string, any> = { "[Object]": proto?.constructor?.name || "Object" };
      for (const k of Object.keys(val).slice(0, 6)) {
        try {
          summary[k] = this.safeSerializeValue((val as any)[k], seen, depth + 1);
        } catch {
          summary[k] = "[ErrorReading]";
        }
      }
      return summary;
    }

    return String(val);
  }

  private safeSerializeEnv(envSnapshot: any): Record<string, any> {
    const out: Record<string, any> = {};
    if (!envSnapshot || typeof envSnapshot !== "object") return out;

    const HIDDEN_GLOBALS = new Set([
      "Math","JSON","Number","String","Boolean","Object","Array","Function","Date","RegExp","Error","TypeError",
      "ReferenceError","SyntaxError","Promise","Reflect","Proxy","Intl","WeakMap","WeakSet","Set","Map","console",
      "__proto__","__env","__body","__params","bindings","outer","record",
    ]);

    const frames = Array.isArray(envSnapshot) ? envSnapshot : Object.values(envSnapshot);

    for (const frame of frames) {
      if (!frame) continue;

      let name = "Global";
      if (typeof frame === "object" && frame !== null && "name" in frame) {
        name = (frame as any).name || "Global";
      }

      const bindings =
        typeof frame === "object" && frame !== null && "bindings" in frame && (frame as any).bindings
          ? (frame as any).bindings
          : frame;

      if (typeof name === "string" && name.startsWith("Block#") && Object.keys(bindings as any).length === 0) {
        continue;
      }

      const cleaned: Record<string, any> = {};
      for (const key of Object.keys(bindings as any)) {
        if (HIDDEN_GLOBALS.has(key)) continue;
        try {
          cleaned[key] = this.safeSerializeValue((bindings as any)[key]);
        } catch {
          cleaned[key] = "[Error]";
        }
      }

      if (Object.keys(cleaned).length > 0) {
        out[name] = cleaned;
      }
    }

    return out;
  }

  // ---------------- Diff ----------------
  private computeDiff(prev: Record<string, any> | null, curr: Record<string, any>): DiffSnapshot {
    const diff: DiffSnapshot = { added: {}, changed: {}, removed: {} };

    if (!prev) {
      for (const scope of Object.keys(curr)) {
        const vars = curr[scope];
        for (const k of Object.keys(vars)) {
          diff.added[`${scope}.${k}`] = vars[k];
        }
      }
      return diff;
    }

    for (const scope of Object.keys(curr)) {
      const currVars = curr[scope] || {};
      const prevVars = prev[scope] || {};
      for (const k of Object.keys(currVars)) {
        const key = `${scope}.${k}`;
        if (!(scope in prev) || !(k in prevVars)) {
          diff.added[key] = currVars[k];
        } else {
          const prevVal = prevVars[k];
          const currVal = currVars[k];
          const same = JSON.stringify(prevVal) === JSON.stringify(currVal);
          if (!same) diff.changed[key] = { from: prevVal, to: currVal };
        }
      }
    }

    for (const scope of Object.keys(prev)) {
      const prevVars = prev[scope] || {};
      const currVars = curr[scope] || {};
      for (const k of Object.keys(prevVars)) {
        if (!(scope in curr) || !(k in currVars)) {
          diff.removed[`${scope}.${k}`] = prevVars[k];
        }
      }
    }

    return diff;
  }

  // ---------------- Logging steps ----------------
  log(line: number) {
    if (this.step > this.maxSteps) throw new Error("Step limit exceeded");

    const env = this.getEnvSnapshot();
    let rawVars: any;
    try {
      rawVars = (env as any).snapshotChain ? (env as any).snapshotChain() : env;
    } catch {
      rawVars = env;
    }

    const serializedVars = this.safeSerializeEnv(rawVars);
    const diff = this.computeDiff(this.lastVars, serializedVars);
    this.lastVars = serializedVars;

    const entry: TimelineEntry = {
      step: this.step++,
      line,
      variables: serializedVars,
      heap: {},
      stack: [...this.getStack()],
      output: [...this.output],
      diff,
      meta: {
        kind: "statement",
        functionName: this.getStack().slice(-1)[0] || null,
        scopeName: env.name,
        closureVariables: null,
      },
    };

    this.entries.push(entry);
  }

  setNext(line: number | null, message: string, entry?: TimelineEntry) {
    const target = entry ?? this.entries[this.entries.length - 1];
    if (!target) return;
    // replace empty messages with nothing; avoid overriding existing message with empty
    if (message === "" && target.nextStep) return;
    target.nextStep = { line, message };
  }

  updateMeta(data: Partial<StepMetadata>) {
    const last = this.peekLastStep();
    if (last) {
      last.meta = { ...last.meta, ...data };
    }
  }

  hasNext(): boolean {
    const last = this.entries[this.entries.length - 1];
    return !!last?.nextStep;
  }

  peekNext(): NextStep | undefined {
    const last = this.entries[this.entries.length - 1];
    return last?.nextStep;
  }

  peekLastStep(): TimelineEntry | undefined {
    return this.entries[this.entries.length - 1];
  }

  // control flow narration
  addFlow(message: string) {
    const last = this.entries[this.entries.length - 1];
    if (!last) return;
    if (!last.controlFlow) last.controlFlow = [];
    last.controlFlow.push(message);
  }

  // expression helpers used by evaluator
  private safeValue(nameOrNode: any): any {
    try {
      const env = this.getEnvSnapshot();
      if (!env || typeof (env as any).get !== "function") return undefined;
      const name = typeof nameOrNode === "string" ? nameOrNode : nameOrNode?.name;
      return (env as any).get(name);
    } catch {
      return undefined;
    }
  }

  private applyOperator(l: any, r: any, op: string): any {
    switch (op) {
      case "+": return l + r;
      case "-": return l - r;
      case "*": return l * r;
      case "/": return l / r;
      case "%": return l % r;
      case "==": return l == r;
      case "===": return l === r;
      case "!=": return l != r;
      case "!==": return l !== r;
      case "<": return l < r;
      case ">": return l > r;
      case "<=": return l <= r;
      case ">=": return l >= r;
      default: return undefined;
    }
  }

  // Build breakdown (kept conservative)
  private buildExpressionBreakdown(expr: any): string[] {
    const lines: string[] = [];
    const walk = (node: any, indent = ""): any => {
      if (!node) { lines.push(indent + "(empty)"); return undefined; }
      const log = (msg: string) => lines.push(indent + msg);

      switch (node.type) {
        case "Identifier": {
          const v = this.safeValue(node.name);
          const display = isUserFunctionValue(v) ? "[Function]" : JSON.stringify(v);
          log(`Identifier "${node.name}" → ${display}`);
          return v;
        }
        case "Literal": {
          log(`Literal → ${JSON.stringify(node.value)}`);
          return node.value;
        }
        case "BinaryExpression": {
          log(`Binary Expression (${node.operator}):`);
          const left = walk(node.left, indent + "  ");
          const right = walk(node.right, indent + "  ");
          const result = this.applyOperator(left, right, node.operator);
          log(`=> ${JSON.stringify(left)} ${node.operator} ${JSON.stringify(right)} = ${JSON.stringify(result)}`);
          return result;
        }
        case "LogicalExpression": {
          log(`Logical Expression (${node.operator}):`);
          const left = walk(node.left, indent + "  ");
          let result;
          if (node.operator === "&&") result = left && walk(node.right, indent + "  ");
          else if (node.operator === "||") result = left || walk(node.right, indent + "  ");
          else result = walk(node.right, indent + "  ");
          log(`=> ${JSON.stringify(result)}`);
          return result;
        }
        case "UnaryExpression": {
          const val = walk(node.argument, indent + "  ");
          switch (node.operator) {
            case "!": log(`Unary ! → ${!val}`); return !val;
            case "+": log(`Unary + → ${+val}`); return +val;
            case "-": log(`Unary - → ${-val}`); return -val;
            case "typeof": log(`typeof → ${typeof val}`); return typeof val;
            default: log(`Unary (${node.operator}) not simulated`); return undefined;
          }
        }
        case "MemberExpression": {
          log("Member access:");
          const obj = walk(node.object, indent + "  ");
          let prop;
          if (node.computed) prop = walk(node.property, indent + "  ");
          else { prop = node.property.name; log(`${indent}  Property: "${prop}"`); }
          if (obj === undefined || obj === null) { log(`${indent}  Cannot read property of ${JSON.stringify(obj)}`); return undefined; }
          const result = (obj as any)[prop];
          log(`${indent}  Result → ${JSON.stringify(result)}`);
          return result;
        }
        case "CallExpression": {
          log("Call Expression:");
          const calleeVal = walk(node.callee, indent + "  ");
          const calleeDisplay = typeof calleeVal === "function" || (calleeVal && calleeVal.__isFunctionValue) ? "[Function]" : JSON.stringify(calleeVal);
          log(indent + `  Callee → ${calleeDisplay}`);
          if (node.arguments && node.arguments.length) {
            log(indent + "  Arguments:");
            for (const arg of node.arguments) {
              const argVal = walk(arg, indent + "    ");
              const argDisplay = typeof argVal === "function" || (argVal && argVal.__isFunctionValue) ? "[Function]" : JSON.stringify(argVal);
              log(indent + "    " + argDisplay);
            }
          } else log(indent + "  (no arguments)");
          log(indent + "  (call result not evaluated here)");
          return "[FunctionCall]";
        }
        case "ArrayExpression": {
          log("Array Expression:");
          const items = node.elements.map((el: any) => walk(el, indent + "  "));
          log(`${indent}  [${items.map(i => JSON.stringify(i)).join(", ")}]`);
          return items;
        }
        case "ObjectExpression": {
          log("Object Expression:");
          const out: any = {};
          for (const prop of node.properties) {
            const key = prop.key.type === "Identifier" ? prop.key.name : walk(prop.key, indent + "  ");
            const val = walk(prop.value, indent + "  ");
            out[key] = val;
            log(`${indent}  ${String(key)}: ${JSON.stringify(val)}`);
          }
          return out;
        }
        case "AssignmentExpression": {
          log(`Assignment (${node.operator}):`);
          if (node.left.type !== "Identifier") { log("Unsupported assignment target (not Identifier)"); return undefined; }
          const name = node.left.name;
          const oldVal = this.safeValue(name);
          log(`Left side identifier "${name}" → old value ${JSON.stringify(oldVal)}`);
          const rightVal = walk(node.right, indent + "  ");
          let newVal;
          switch (node.operator) {
            case "=": newVal = rightVal; break;
            case "+=": newVal = (oldVal as any) + rightVal; break;
            case "-=": newVal = (oldVal as any) - rightVal; break;
            case "*=": newVal = (oldVal as any) * rightVal; break;
            case "/=": newVal = (oldVal as any) / rightVal; break;
            case "%=": newVal = (oldVal as any) % rightVal; break;
            default: log(`Unsupported assignment operator "${node.operator}"`); return undefined;
          }
          log(`=> ${name} ${node.operator} ${JSON.stringify(rightVal)} sets new value ${JSON.stringify(newVal)}`);
          return newVal;
        }
        default:
          log(`(Unsupported node type in breakdown: ${node.type})`);
          return undefined;
      }
    };

    try { walk(expr); } catch { lines.push("(error while building breakdown)"); }
    return lines;
  }

  private makeFriendlyExplanation(expr: any, result: any): string[] {
    if (!expr || !expr.type) return [`Expression result: ${result}`];
    if (expr.type === "BinaryExpression") {
      const op = expr.operator;
      const leftNode = expr.left;
      const rightNode = expr.right;
      const leftName = leftNode?.type === "Identifier" ? leftNode.name : this.code.substring(leftNode?.range?.[0] ?? 0, leftNode?.range?.[1] ?? 0);
      const rightName = rightNode?.type === "Identifier" ? rightNode.name : this.code.substring(rightNode?.range?.[0] ?? 0, rightNode?.range?.[1] ?? 0);
      const leftVal = leftNode?.type === "Literal" ? leftNode.value : this.safeValue(leftNode?.name ?? leftName);
      const rightVal = rightNode?.type === "Literal" ? rightNode.value : this.safeValue(rightNode?.name ?? rightName);
      const lines: string[] = [];
      const exprString = this.code.substring(expr.range?.[0] ?? 0, expr.range?.[1] ?? 0);
      lines.push(`Expression: ${exprString}`);
      if (leftName) lines.push(`${leftName} is ${JSON.stringify(leftVal)}`);
      if (rightName) lines.push(`${rightName} is ${JSON.stringify(rightVal)}`);
      if (op === "%") {
        lines.push(`${leftVal} % ${rightVal} gives remainder ${this.applyOperator(leftVal, rightVal, "%")}`);
      } else if (["==", "===", "!=", "!=="].includes(op)) {
        lines.push(`Comparison result → ${result}`);
      } else if (["<", "<=", ">", ">="].includes(op)) {
        lines.push(`Is ${leftVal} ${op} ${rightVal}? → ${result}`);
      } else {
        lines.push(`${leftVal} ${op} ${rightVal} = ${result}`);
      }
      lines.push(`Final Result: ${result}`);
      return lines;
    }
    return [`Expression result: ${result}`];
  }

  private safeExpressionResult(val: any): any {
    if (val === null || val === undefined) return val;
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") return val;
    if (val && typeof val === "object" && val.__isFunctionValue) return "[Function]";
    if (typeof val === "function") return "[NativeFunction]";
    if (Array.isArray(val)) return val.map(v => this.safeExpressionResult(v));
    if (typeof val === "object") {
      const out: Record<string, any> = {};
      for (const k of Object.keys(val).slice(0, 5)) out[k] = this.safeExpressionResult(val[k]);
      return out;
    }
    return String(val);
  }

  addExpressionEval(expr: any, value: any, customBreakdown?: string[]) {
    const last = this.entries[this.entries.length - 1];
    if (!last || !expr) return;

    let exprString = "<expr>";
    try {
      exprString = expr.range ? this.code.substring(expr.range[0], expr.range[1]) : expr.type || "<expr>";
    } catch {
      exprString = expr.type || "<expr>";
    }

    if (!last.expressionEval) last.expressionEval = {};

    const breakdown = (customBreakdown ?? this.buildExpressionBreakdown(expr)).map(line => typeof line === "string" ? line : String(line));

    let friendly: string[];
    try {
      friendly = this.makeFriendlyExplanation(expr, value).map(x => typeof x === "string" ? x : String(x));
    } catch {
      friendly = [`Expression result: ${value}`];
    }

    last.expressionEval[exprString] = {
      result: this.safeExpressionResult(value),
      breakdown,
      friendly,
    };
  }

  addExpressionContext(expr: any, context: string) {
    const last = this.entries[this.entries.length - 1];
    if (!last || !expr) return;
    const exprString = expr.range ? this.code.substring(expr.range[0], expr.range[1]) : expr.type || "<expr>";
    if (!last.expressionEval) last.expressionEval = {};
    if (!last.expressionEval[exprString]) last.expressionEval[exprString] = { result: undefined, breakdown: [] };
    last.expressionEval[exprString].context = context;
  }

  logOutput(...args: any[]) {
    const text = args.map(arg => {
      try {
        if (typeof arg === "object" && arg !== null) return JSON.stringify(arg);
        return String(arg);
      } catch {
        return "[Circular]";
      }
    }).join(" ");

    this.output.push(text);
    const last = this.entries[this.entries.length - 1];
    if (last) last.output = [...this.output];
  }

  getTimeline(): TimelineEntry[] {
    return this.entries;
  }
}

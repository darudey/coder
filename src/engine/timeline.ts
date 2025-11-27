// src/engine/timeline.ts
import type { LexicalEnvironment } from "./environment";

export interface ExpressionInfo {
  result: any;
  breakdown: string[];
  context?: string;
  friendly?: string[];
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
  nextStep?: {
    line: number | null;
    message: string;
  };
}

function isUserFunctionValue(value: any) {
  return value && typeof value === "object" && value.__isFunctionValue === true;
}

export class TimelineLogger {
  private entries: TimelineEntry[] = [];
  private step = 1;
  private output: string[] = [];

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

  // ---------- SAFE SERIALIZER ----------

  private safeSerializeValue(val: any, seen = new WeakSet(), depth = 0): any {
    if (val === undefined) return undefined;
    if (val === null) return null;
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      return val;
    }
    if (typeof val === "function") {
      return "[NativeFunction]";
    }
    if (isUserFunctionValue(val)) {
      return "[Function]";
    }
    if (depth > 2) {
      return "[Object]";
    }
    if (Array.isArray(val)) {
      return val.map((v) => this.safeSerializeValue(v, seen, depth + 1));
    }
    if (typeof val === "object") {
      if (seen.has(val)) return "[Circular]";
      seen.add(val);

      // Special-case Math: show functions as [NativeFunction]
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

      // Generic instance / DOM / class object
      const summary: Record<string, any> = {
        "[Object]": proto?.constructor?.name || "Object",
      };
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

    // Case 1: snapshotChain gives an array of frames
    if (Array.isArray(envSnapshot)) {
      for (const frame of envSnapshot) {
        if (!frame) continue;

        // Shape: { name, bindings }
        if (frame.name && frame.bindings) {
          out[frame.name] = this.safeSerializeValue(frame.bindings);
        } else if (typeof frame === "object") {
          const name = (frame as any).name || "[scope]";
          const bindings =
            (frame as any).bindings && typeof (frame as any).bindings === "object"
              ? (frame as any).bindings
              : frame;
          out[name] = this.safeSerializeValue(bindings);
        }
      }
      return out;
    }

    // Case 2: plain object map of scopes
    for (const key of Object.keys(envSnapshot)) {
      try {
        out[key] = this.safeSerializeValue(envSnapshot[key]);
      } catch {
        out[key] = "[ErrorSerializing]";
      }
    }
    return out;
  }

  // ---------- STEP LOGGING ----------

  log(line: number) {
    if (this.step > this.maxSteps) {
      throw new Error("Step limit exceeded");
    }

    const env = this.getEnvSnapshot();
    let rawVars: any;
    try {
      rawVars = (env as any).snapshotChain ? (env as any).snapshotChain() : env;
    } catch {
      rawVars = env;
    }

    const serializedVars = this.safeSerializeEnv(rawVars);

    const entry: TimelineEntry = {
      step: this.step++,
      line,
      variables: serializedVars,
      heap: {},
      stack: [...this.getStack()],
      output: [...this.output],
    };

    this.entries.push(entry);
  }

  setNext(line: number | null, message: string) {
    const last = this.entries[this.entries.length - 1];
    if (!last) return;
    last.nextStep = { line, message };
  }

  hasNext(): boolean {
    const last = this.entries[this.entries.length - 1];
    return !!last?.nextStep;
  }

  // ---------- CONTROL FLOW NARRATION ----------

  addFlow(message: string) {
    const last = this.entries[this.entries.length - 1];
    if (!last) return;
    if (!last.controlFlow) last.controlFlow = [];
    last.controlFlow.push(message);
  }

  // ---------- EXPRESSION BREAKDOWN ----------

  private safeValue(nameOrNode: any): any {
    try {
      const env = this.getEnvSnapshot();
      if (!env || typeof (env as any).get !== "function") return undefined;
      const name =
        typeof nameOrNode === "string" ? nameOrNode : nameOrNode?.name;
      return (env as any).get(name);
    } catch {
      return undefined;
    }
  }

  private applyOperator(l: any, r: any, op: string): any {
    switch (op) {
      case "+":
        return l + r;
      case "-":
        return l - r;
      case "*":
        return l * r;
      case "/":
        return l / r;
      case "%":
        return l % r;
      case "==":
        return l == r;
      case "===":
        return l === r;
      case "!=":
        return l != r;
      case "!==":
        return l !== r;
      case "<":
        return l < r;
      case ">":
        return l > r;
      case "<=":
        return l <= r;
      case ">=":
        return l >= r;
      default:
        return undefined;
    }
  }

  private buildExpressionBreakdown(expr: any): string[] {
    const lines: string[] = [];

    const walk = (node: any, indent = ""): any => {
      if (!node) {
        lines.push(indent + "(empty)");
        return undefined;
      }

      const log = (msg: string) => lines.push(indent + msg);

      switch (node.type) {
        case "Identifier": {
          const v = this.safeValue(node.name);
          log(`Identifier "${node.name}" → ${JSON.stringify(v)}`);
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
          log(
            `=> ${JSON.stringify(left)} ${node.operator} ${JSON.stringify(
              right
            )} = ${JSON.stringify(result)}`
          );
          return result;
        }

        case "LogicalExpression": {
          log(`Logical Expression (${node.operator}):`);
          const left = walk(node.left, indent + "  ");
          let result;
          if (node.operator === "&&") {
            result = left && walk(node.right, indent + "  ");
          } else if (node.operator === "||") {
            result = left || walk(node.right, indent + "  ");
          } else {
            result = walk(node.right, indent + "  ");
          }
          log(`=> ${JSON.stringify(result)}`);
          return result;
        }

        case "UnaryExpression": {
          const val = walk(node.argument, indent + "  ");
          switch (node.operator) {
            case "!":
              log(`Unary ! → ${!val}`);
              return !val;
            case "+":
              log(`Unary + → ${+val}`);
              return +val;
            case "-":
              log(`Unary - → ${-val}`);
              return -val;
            case "typeof":
              log(`typeof → ${typeof val}`);
              return typeof val;
            default:
              log(`Unary (${node.operator}) not simulated`);
              return undefined;
          }
        }

        case "UpdateExpression": {
          const id = node.argument.name;
          const current = this.safeValue(id);
          const newVal = node.operator === "++" ? current + 1 : current - 1;
          log(
            `Update: ${id} ${node.operator} (old = ${JSON.stringify(
              current
            )}, new = ${JSON.stringify(newVal)})`
          );
          return node.prefix ? newVal : current;
        }

        case "MemberExpression": {
          log("Member access:");
          const obj = walk(node.object, indent + "  ");
          let prop;
          if (node.computed) {
            prop = walk(node.property, indent + "  ");
          } else {
            prop = node.property.name;
            log(`${indent}  Property: "${prop}"`);
          }
          if (obj === undefined || obj === null) {
            log(`${indent}  Cannot read property of ${JSON.stringify(obj)}`);
            return undefined;
          }
          const result = obj[prop];
          log(`${indent}  Result → ${JSON.stringify(result)}`);
          return result;
        }

        case "ArrayExpression": {
          log("Array Expression:");
          const items = node.elements.map((el: any) =>
            walk(el, indent + "  ")
          );
          log(
            `${indent}  [${items.map((i) => JSON.stringify(i)).join(", ")}]`
          );
          return items;
        }

        case "ObjectExpression": {
          log("Object Expression:");
          const out: any = {};
          for (const prop of node.properties) {
            const key =
              prop.key.type === "Identifier"
                ? prop.key.name
                : walk(prop.key, indent + "  ");
            const val = walk(prop.value, indent + "  ");
            out[key] = val;
            log(`${indent}  ${String(key)}: ${JSON.stringify(val)}`);
          }
          return out;
        }

        case "CallExpression": {
          log("Call Expression:");
          walk(node.callee, indent + "  ");
          if (node.arguments && node.arguments.length) {
            log(indent + "  Arguments:");
            node.arguments.forEach((a: any) =>
              walk(a, indent + "    ")
            );
          } else {
            log(indent + "  (no arguments)");
          }
          log(indent + "  (call result not evaluated in breakdown)");
          return "[FunctionCall]";
        }

        default:
          log(`(Unsupported node type in breakdown: ${node.type})`);
          return undefined;
      }
    };

    try {
      walk(expr);
    } catch {
      lines.push("(error while building breakdown)");
    }

    return lines;
  }

  private makeFriendlyExplanation(expr: any, result: any): string[] {
    if (!expr || !expr.type) return [`Expression result: ${result}`];

    if (expr.type === "BinaryExpression") {
      const op = expr.operator;
      const leftName =
        expr.left?.type === "Identifier"
          ? expr.left.name
          : this.code.substring(
              expr.left?.range?.[0] ?? 0,
              expr.left?.range?.[1] ?? 0
            );
      const rightName =
        expr.right?.type === "Identifier"
          ? expr.right.name
          : this.code.substring(
              expr.right?.range?.[0] ?? 0,
              expr.right?.range?.[1] ?? 0
            );

      const leftVal = this.safeValue(expr.left?.name ?? leftName);
      const rightVal = this.safeValue(expr.right?.name ?? rightName);

      const lines: string[] = [];
      const exprString = this.code.substring(
        expr.range?.[0] ?? 0,
        expr.range?.[1] ?? 0
      );

      lines.push(`Expression: ${exprString}`);
      if (leftName) lines.push(`${leftName} is ${JSON.stringify(leftVal)}`);
      if (rightName) lines.push(`${rightName} is ${JSON.stringify(rightVal)}`);

      if (op === "%") {
        lines.push(
          `${leftVal} % ${rightVal} gives remainder ${this.applyOperator(
            leftVal,
            rightVal,
            "%"
          )}`
        );
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

  // ---------- EXPRESSION API ----------

  addExpressionEval(expr: any, value: any, customBreakdown?: string[]) {
    const last = this.entries[this.entries.length - 1];
    if (!last || !expr) return;

    const exprString = expr.range
      ? this.code.substring(expr.range[0], expr.range[1])
      : expr.type || "<expr>";

    if (!last.expressionEval) last.expressionEval = {};

    const breakdown = customBreakdown ?? this.buildExpressionBreakdown(expr);
    const friendly = this.makeFriendlyExplanation(expr, value);

    last.expressionEval[exprString] = {
      result: value,
      breakdown,
      friendly,
    };
  }

  addExpressionContext(expr: any, context: string) {
    const last = this.entries[this.entries.length - 1];
    if (!last || !expr) return;

    const exprString = expr.range
      ? this.code.substring(expr.range[0], expr.range[1])
      : expr.type || "<expr>";

    if (!last.expressionEval) last.expressionEval = {};
    if (!last.expressionEval[exprString]) {
      last.expressionEval[exprString] = {
        result: undefined,
        breakdown: [],
      };
    }
    last.expressionEval[exprString].context = context;
  }

  // ---------- OUTPUT ----------

  logOutput(...args: any[]) {
    const text = args
      .map((arg) => {
        try {
          if (typeof arg === "object" && arg !== null) {
            return JSON.stringify(arg);
          }
          return String(arg);
        } catch {
          return "[Circular]";
        }
      })
      .join(" ");

    this.output.push(text);

    const last = this.entries[this.entries.length - 1];
    if (last) {
      last.output = [...this.output];
    }
  }

  getTimeline(): TimelineEntry[] {
    return this.entries;
  }
}

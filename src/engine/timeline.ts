
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
  /**
   * Keys are "Scope.var", e.g. "Global.x", "test.a"
   */
  added: Record<string, any>;
  changed: Record<string, { from: any; to: any }>;
  removed: Record<string, any>;
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
}

function isUserFunctionValue(value: any) {
  return value && typeof value === "object" && value.__isFunctionValue === true;
}

export class TimelineLogger {
  private entries: TimelineEntry[] = [];
  private step = 1;
  private output: string[] = [];

  // last serialized variables snapshot, used for diff calculation
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

  // ---------- SAFE SERIALIZER FOR VARIABLE VALUES ----------

  private safeSerializeValue(
    val: any,
    seen = new WeakSet(),
    depth = 0
  ): any {
    if (val === undefined) return undefined;
    if (val === null) return null;
    if (
      typeof val === "string" ||
      typeof val === "number" ||
      typeof val === "boolean"
    ) {
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
            out[k] = this.safeSerializeValue(
              (val as any)[k],
              seen,
              depth + 1
            );
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
          summary[k] = this.safeSerializeValue(
            (val as any)[k],
            seen,
            depth + 1
          );
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

    // --- HIDE USELESS GLOBALS ---
    const HIDDEN_GLOBALS = new Set([
      "Math",
      "JSON",
      "Number",
      "String",
      "Boolean",
      "Object",
      "Array",
      "Function",
      "Date",
      "RegExp",
      "Error",
      "TypeError",
      "ReferenceError",
      "SyntaxError",
      "Promise",
      "Reflect",
      "Proxy",
      "Intl",
      "WeakMap",
      "WeakSet",
      "Set",
      "Map",
      "console",
      // engine internals
      "__proto__",
      "__env",
      "__body",
      "__params",
      "bindings",
      "outer",
      "record",
    ]);

    const frames = Array.isArray(envSnapshot)
      ? envSnapshot
      : Object.values(envSnapshot);

    for (const frame of frames) {
      if (!frame) continue;

      let name = "Global";
      if (typeof frame === "object" && frame !== null && "name" in frame) {
        name = (frame as any).name || "Global";
      }

      const bindings =
        typeof frame === "object" &&
        frame !== null &&
        "bindings" in frame &&
        (frame as any).bindings
          ? (frame as any).bindings
          : frame;

      if (
        typeof name === "string" &&
        name.startsWith("Block#") &&
        Object.keys(bindings as any).length === 0
      ) {
        continue;
      }

      const cleaned: Record<string, any> = {};
      for (const key of Object.keys(bindings as any)) {
        if (HIDDEN_GLOBALS.has(key)) continue;
        try {
          cleaned[key] = this.safeSerializeValue(
            (bindings as any)[key]
          );
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

  // ---------- DIFF CALCULATION ----------

  private computeDiff(
    prev: Record<string, any> | null,
    curr: Record<string, any>
  ): DiffSnapshot {
    const diff: DiffSnapshot = {
      added: {},
      changed: {},
      removed: {},
    };

    if (!prev) {
      // First step: everything is "added"
      for (const scope of Object.keys(curr)) {
        const vars = curr[scope];
        for (const k of Object.keys(vars)) {
          const key = `${scope}.${k}`;
          diff.added[key] = vars[k];
        }
      }
      return diff;
    }

    // ADDED / CHANGED
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
          const same =
            JSON.stringify(prevVal) === JSON.stringify(currVal);
          if (!same) {
            diff.changed[key] = { from: prevVal, to: currVal };
          }
        }
      }
    }

    // REMOVED
    for (const scope of Object.keys(prev)) {
      const prevVars = prev[scope] || {};
      const currVars = curr[scope] || {};
      for (const k of Object.keys(prevVars)) {
        if (!(scope in curr) || !(k in currVars)) {
          const key = `${scope}.${k}`;
          diff.removed[key] = prevVars[k];
        }
      }
    }

    return diff;
  }

  // ---------- STEP LOGGING ----------

  log(line: number) {
    if (this.step > this.maxSteps) {
      throw new Error("Step limit exceeded");
    }

    const env = this.getEnvSnapshot();
    let rawVars: any;
    try {
      rawVars = (env as any).snapshotChain
        ? (env as any).snapshotChain()
        : env;
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
    };

    this.entries.push(entry);
  }

  /**
   * Set the "next step" prediction.
   * If `entry` is provided, we patch that specific step;
   * otherwise we patch the latest one.
   */
  setNext(
    line: number | null,
    message: string,
    entry?: TimelineEntry
  ) {
    const target =
      entry ?? this.entries[this.entries.length - 1];
    if (!target) return;
    target.nextStep = { line, message };
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

  // ---------- CONTROL FLOW NARRATION ----------

  /**
   * Core hack to kill those giant FunctionValue dumps in Control Flow
   * no matter who still uses JSON.stringify(value) elsewhere.
   */
  private sanitizeFlowMessage(message: string): string {
    if (typeof message !== "string") return String(message);

    // If someone dumped a FunctionValue JSON (it always has __isFunctionValue)
    if (message.includes('"__isFunctionValue":true')) {
      const braceIndex = message.indexOf("{");
      if (braceIndex >= 0) {
        // Keep prefix, nuke the object body
        return message.slice(0, braceIndex).trimEnd() + " [Function]";
      }
      return "[Function]";
    }

    return message;
  }

  addFlow(message: string) {
    const last = this.entries[this.entries.length - 1];
    if (!last) return;
    if (!last.controlFlow) last.controlFlow = [];

    const safeMsg = this.sanitizeFlowMessage(message);
    last.controlFlow.push(safeMsg);
  }

  // ---------- HELPER FOR EXPRESSION EVAL ----------

  private safeValue(nameOrNode: any): any {
    try {
      const env = this.getEnvSnapshot();
      if (!env || typeof (env as any).get !== "function") return undefined;
      const name =
        typeof nameOrNode === "string"
          ? nameOrNode
          : nameOrNode?.name;
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
        case "ArrowFunctionExpression": {
            log("Arrow Function:");
            log(indent + `  Parameters: (${node.params.map((p:any) => p.name).join(", ")})`);
            log(indent + `  Body: ${this.getCode()?.substring(node.body.range[0], node.body.range[1])}`);
            return "[Function]";
        }
        case "Identifier": {
          const v = this.safeValue(node.name);
          const display = isUserFunctionValue(v)
            ? "[Function]"
            : JSON.stringify(this.safeSerializeValue(v));
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
          const result = this.applyOperator(
            left,
            right,
            node.operator
          );
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
          const newVal =
            node.operator === "++" ? current + 1 : current - 1;
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
            log(
              `${indent}  Cannot read property of ${JSON.stringify(
                obj
              )}`
            );
            return undefined;
          }
          const result = (obj as any)[prop];
          log(`${indent}  Result → ${JSON.stringify(result)}`);
          return result;
        }

        case "ArrayExpression": {
          log("Array Expression:");
          const items = node.elements.map((el: any) =>
            walk(el, indent + "  ")
          );
          log(
            `${indent}  [${items
              .map((i) => JSON.stringify(i))
              .join(", ")}]`
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
            log(
              `${indent}  ${String(key)}: ${JSON.stringify(val)}`
            );
          }
          return out;
        }

        case "CallExpression": {
          log("Call Expression:");

          // --- Callee evaluation ---
          const calleeVal = walk(node.callee, indent + "  ");

          const calleeDisplay =
            typeof calleeVal === "function" ||
            (calleeVal && calleeVal.__isFunctionValue)
              ? "[Function]"
              : JSON.stringify(calleeVal);

          log(indent + `  Callee → ${calleeDisplay}`);

          // --- Arguments ---
          if (node.arguments && node.arguments.length) {
            log(indent + "  Arguments:");
            for (const arg of node.arguments) {
              const argVal = walk(arg, indent + "    ");
              const argDisplay =
                typeof argVal === "function" ||
                (argVal && argVal.__isFunctionValue)
                  ? "[Function]"
                  : JSON.stringify(argVal);

              log(indent + "    " + argDisplay);
            }
          } else {
            log(indent + "  (no arguments)");
          }

          // We do NOT evaluate call result here, evaluator handles it separately
          log(indent + "  (call result not evaluated here)");
          return "[FunctionCall]";
        }

        case "AssignmentExpression": {
          log(`Assignment (${node.operator}):`);

          if (node.left.type !== "Identifier") {
            log("Unsupported assignment target (not Identifier)");
            return undefined;
          }

          const name = node.left.name;
          const oldVal = this.safeValue(name);
          log(
            `Left side identifier "${name}" → old value ${JSON.stringify(
              oldVal
            )}`
          );

          const rightVal = walk(node.right, indent + "  ");

          let newVal;
          switch (node.operator) {
            case "=":
              newVal = rightVal;
              break;
            case "+=":
              newVal = (oldVal as any) + rightVal;
              break;
            case "-=":
              newVal = (oldVal as any) - rightVal;
              break;
            case "*=":
              newVal = (oldVal as any) * rightVal;
              break;
            case "/=":
              newVal = (oldVal as any) / rightVal;
              break;
            case "%=":
              newVal = (oldVal as any) % rightVal;
              break;
            default:
              log(
                `Unsupported assignment operator "${node.operator}"`
              );
              return undefined;
          }

          log(
            `=> ${name} ${node.operator} ${JSON.stringify(
              rightVal
            )} sets new value ${JSON.stringify(newVal)}`
          );

          return newVal;
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

  private makeFriendlyExplanation(
    expr: any,
    result: any
  ): string[] {
    // Keep this simple & safe — user mostly cares about final result.
    return [`Expression result: ${this.safeSerializeValue(result)}`];
  }

  // ---------- EXPRESSION API ----------

  private safeExpressionResult(val: any): any {
    // primitives
    if (val === null || val === undefined) return val;
    if (
      typeof val === "string" ||
      typeof val === "number" ||
      typeof val === "boolean"
    )
      return val;

    // avoid leaking internal FunctionValue
    if (val && typeof val === "object" && val.__isFunctionValue) {
      return "[Function]";
    }

    // plain function
    if (typeof val === "function") return "[NativeFunction]";

    // arrays → shallow sanitize
    if (Array.isArray(val)) {
      return val.map((v) => this.safeExpressionResult(v));
    }

    // objects → shallow sanitize
    if (typeof val === "object") {
      const out: Record<string, any> = {};
      for (const k of Object.keys(val).slice(0, 5)) {
        out[k] = this.safeExpressionResult(val[k]);
      }
      return out;
    }

    return String(val);
  }

  addExpressionEval(
    expr: any,
    value: any,
    customBreakdown?: string[]
  ) {
    const last = this.entries[this.entries.length - 1];
    if (!last || !expr) return;

    // Expression key must always be a SAFE STRING
    let exprString = "<expr>";
    try {
      exprString = expr.range
        ? this.code.substring(expr.range[0], expr.range[1])
        : expr.type || "<expr>";
    } catch {
      exprString = expr.type || "<expr>";
    }

    if (!last.expressionEval) last.expressionEval = {};

    const breakdown =
      (customBreakdown ?? this.buildExpressionBreakdown(expr)).map((line) =>
        typeof line === "string" ? line : String(line)
      );

    let friendly: string[];
    try {
      friendly = this.makeFriendlyExplanation(expr, value).map((x) =>
        typeof x === "string" ? x : String(x)
      );
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
            // sanitize result before stringifying
            const safe = this.safeExpressionResult(arg);
            return JSON.stringify(safe);
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

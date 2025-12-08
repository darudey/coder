
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
  // closure/captured panel (populated when function values are evaluated)
  captured?: string[] | Record<string, any>;
  // structured metadata used by UI (hybrid-normalized)
  metadata?: {
    // normalized keys (preferred)
    kind?: string; // "Statement" | "FunctionCall" | "ArrowCall" | "Return" | "ConsoleOutput" | "ClosureCreated"
    functionName?: string;
    signature?: string;
    callDepth?: number;
    activeScope?: string;
    capturedAtStep?: number;
    capturedVariables?: Record<string, any>;
    returnedValue?: any;
    consoleOutput?: string;
    statement?: string;
    // backward-compatible/alias keys (kept for compatibility but mapped into normalized fields)
    // Additional UI-friendly fields allowed
    [k: string]: any;
  };
}

function isUserFunctionValue(value: any) {
  return value && typeof value === "object" && value.__isFunctionValue === true;
}

/**
 * TimelineLogger
 *
 * Responsibilities:
 * - Record step-by-step timeline entries for the debugger UI.
 * - Safely serialize environment / values for display.
 * - Produce normalized metadata (hybrid mode):
 *     - Keep old fields for backward compatibility but also map them onto normalized keys:
 *         outputText -> consoleOutput
 *         statementText -> statement
 *         capturedAtStep/capturedVariables preserved
 * - Ensure initial steps expose a full snapshot so Step 1 / Step 2 show "full scope" in raw state.
 */
export class TimelineLogger {
  private entries: TimelineEntry[] = [];
  private step = 0;
  private output: string[] = [];
  private lastVars: Record<string, any> | null = null;
  private pendingEntry: Partial<TimelineEntry> | null = null;

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
    if (isUserFunctionValue(val)) {
      try {
        const nodeType = val.__node?.type;
        const name = val.__node?.id?.name || (val.__node?.type === "FunctionExpression" ? "(anonymous)" : "(arrow)");
        // prefer full arrow code slice if available
        if (nodeType === "ArrowFunctionExpression" && val.__node?.range) {
          try {
            return this.code.substring(val.__node.range[0], val.__node.range[1]);
          } catch {}
        }
        return nodeType === "ArrowFunctionExpression" ? `[Arrow closure ${name}]` : `[Function ${name}]`;
      } catch {
        return "[Function]";
      }
    }
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
  private commitPendingEntry() {
    if (this.pendingEntry) {
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

      // ensure variables present even if empty (helps Step 1 / Step 2 full-scope requirement)
      this.pendingEntry.variables = serializedVars || {};
      this.pendingEntry.diff = diff;
      this.pendingEntry.stack = [...this.getStack()];
      this.pendingEntry.output = [...this.output];

      // normalize metadata for backward compatibility (if pendingEntry.metadata exists, normalize aliases)
      if (this.pendingEntry.metadata) {
        this.pendingEntry.metadata = this.normalizeMetadata(this.pendingEntry.metadata);
      }

      this.entries.push(this.pendingEntry as TimelineEntry);
      this.pendingEntry = null;
    }
  }

  /**
   * log(line, isInitialStep?)
   *
   * - isInitialStep: set true when creating the very first "declaration/initialization" step to
   *   preserve a stable step numbering and ensure Step 1 shows full global snapshot.
   */
  log(line: number, isInitialStep = false) {
    if (this.step > this.maxSteps) throw new Error("Step limit exceeded");

    this.commitPendingEntry();

    // compute step id: when first step requested as initial, we want step = 1 and keep consistent numbering
    const currentStepValue = isInitialStep ? (this.step === 0 ? 1 : this.step) : ++this.step;

    // Create pending entry; don't immediately snapshot env — commitPendingEntry will populate variables
    this.pendingEntry = {
      step: currentStepValue,
      line,
      heap: {}, // Heap is not implemented
      captured: {},
      metadata: {
        kind: "Statement",
        callDepth: this.getStack().length,
        activeScope: "Global"
      }
    };

    // if this is the first-ever initial step, ensure internal counter moves forward for further steps
    if (isInitialStep && this.entries.length === 0 && this.step === 0) {
      this.step = 1;
    }
  }

  // ---------------- Metadata helpers (normalization) ----------------
  /**
   * Normalize metadata shape (hybrid mode):
   * - Map legacy keys to modern ones for UI.
   * - Keep both where useful (for backward compatibility).
   */
  private normalizeMetadata(partial: Partial<TimelineEntry["metadata"]>): Partial<TimelineEntry["metadata"]> {
    const out: Partial<TimelineEntry["metadata"]> = { ...(partial || {}) };

    // alias mapping
    if ((partial as any).outputText && !out.consoleOutput) {
      out.consoleOutput = (partial as any).outputText;
    }
    if ((partial as any).statementText && !out.statement) {
      out.statement = (partial as any).statementText;
    }
    // returnedValue might already exist; preserve it
    if ((partial as any).returnedValue !== undefined) {
      out.returnedValue = (partial as any).returnedValue;
    }
    // keep capturedVariables/capturedAtStep as-is (they are already preferred names)
    // ensure callDepth is a number
    if (partial && (partial as any).callDepth !== undefined) {
      out.callDepth = (partial as any).callDepth;
    }
    if ((partial as any).activeScope && !out.activeScope) {
      out.activeScope = (partial as any).activeScope;
    }

    return out;
  }

  // Merge partial metadata into the last entry's metadata
  setLastMetadata(partial: Partial<TimelineEntry["metadata"]>) {
    const target = this.pendingEntry ?? this.entries[this.entries.length - 1];
    if (!target) return;
    const normalized = this.normalizeMetadata(partial || {});
    target.metadata = { ...(target.metadata || {}), ...(normalized as any) };
  }

  // NEW: alias / safer API used by other modules (defensive, same behaviour)
  updateMeta(partial: Partial<TimelineEntry["metadata"]>) {
    // updateMeta is intended to be a safe helper to merge metadata into the current last entry
    // It does not create new steps or modify step indices.
    this.setLastMetadata(partial);
  }

  setNext(line: number | null, message: string, entry?: TimelineEntry) {
    const target = entry ?? this.pendingEntry ?? this.entries[this.entries.length - 1];
    if (!target) return;
    // replace empty messages with nothing; avoid overriding existing message with empty
    if (message === "" && target.nextStep) return;
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

  // control flow narration
  addFlow(message: string) {
    const target = this.pendingEntry ?? this.entries[this.entries.length - 1];
    if (!target) return;
    if (!target.controlFlow) target.controlFlow = [];
    target.controlFlow.push(message);
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

  // ---------------- NEW: capture extractor ----------------
  // Returns a map { name: safeValue } of captured bindings for a user function value.
  private extractCapturedVariables(fnVal: any): Record<string, any> {
    const out: Record<string, any> = {};
    try {
      if (!fnVal || !fnVal.__env) return out;
      const chain = typeof fnVal.__env.snapshotChain === "function" ? fnVal.__env.snapshotChain() : [];

      // iterate frames until we reach global or the top script frame
      for (const frame of chain) {
        if (!frame || !frame.kind) continue;
        // Some frames use 'kind' (global/function/block). The interpreter also uses a Script frame named "Script".
        if (frame.kind === "global" || frame.name === "Script") break;
        const bindings = frame.bindings || {};
        for (const name of Object.keys(bindings)) {
          // avoid internals
          if (name.startsWith("__")) continue;
          try {
            out[name] = this.safeSerializeValue((bindings as any)[name]);
          } catch {
            out[name] = "[ErrorReading]";
          }
        }
      }
    } catch {
      // swallow errors — we never want extraction to crash execution
    }
    return out;
  }

  // Build breakdown (upgraded for functions & arrows)
  private buildExpressionBreakdown(expr: any, evaluatedValue?: any): string[] {
    const lines: string[] = [];
    const walk = (node: any, indent = ""): any => {
      if (!node) { lines.push(indent + "(empty)"); return undefined; }
      const log = (msg: string) => lines.push(indent + msg);

      // Helper to safely slice source code for display
      const codeSlice = (n: any) => {
        try {
          return this.code.substring(n.range?.[0] ?? 0, n.range?.[1] ?? 0).trim();
        } catch {
          return "<code>";
        }
      };

      // Helper: collect captured variables from a FunctionValue runtime object
      const collectCaptured = (fnVal: any): string[] => {
        try {
          if (!fnVal || !fnVal.__env) return [];
          const frames = typeof fnVal.__env.snapshotChain === "function" ? fnVal.__env.snapshotChain() : [];
          const captured: string[] = [];

          // walk outer frames until we hit global/script
          for (const frame of frames) {
            if (!frame || !frame.kind) continue;
            if (frame.kind === "global" || frame.kind === "script") break;
            const names = Object.keys(frame.bindings || {});
            for (const name of names) {
              const val = (frame.bindings || {})[name];
              captured.push(`${name} = ${JSON.stringify(this.safeSerializeValue(val))}`);
            }
          }
          return captured;
        } catch {
          return [];
        }
      };

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

        // ---------------- NEW: FunctionExpression ----------------
        case "FunctionExpression": {
          const name = node.id?.name || "(anonymous)";
          log(`Function definition: ${name}`);
          const params = (node.params || []).map((p: any) => p.type === "Identifier" ? p.name : codeSlice(p));
          if (params.length) log(`${indent}  • Parameters: ${params.join(", ")}`);
          else log(`${indent}  • Parameters: (none)`);

          const bodySnippet = node.body ? codeSlice(node.body) : "<body>";
          log(`${indent}  • Body: ${bodySnippet}`);

          // If we have the evaluated function value, show captured variables
          let fnRuntime = evaluatedValue;
          if (isUserFunctionValue(fnRuntime)) {
            const captured = collectCaptured(fnRuntime);
            if (captured.length) {
              log(`${indent}  • Captures: ${captured.join(", ")}`);
            } else {
              log(`${indent}  • Captures: (none)`);
            }
          } else {
            log(`${indent}  • Captures: (not available in static breakdown)`);
          }
          return "[FunctionExpression]";
        }

        // ---------------- NEW: ArrowFunctionExpression ----------------
        case "ArrowFunctionExpression": {
          const params = (node.params || []).map((p: any) => p.type === "Identifier" ? p.name : codeSlice(p));
          const paramText = params.length ? params.join(", ") : "(none)";
          const isExprBody = node.body && node.body.type !== "BlockStatement";
          const bodySnippet = node.body ? codeSlice(node.body) : "<body>";

          log(`Arrow function → (${paramText}) ${isExprBody ? "→ expression" : "→ block"}`);
          log(`${indent}  • Body: ${bodySnippet}`);

          if (isUserFunctionValue(evaluatedValue)) {
            const captured = collectCaptured(evaluatedValue);
            if (captured.length) {
              log(`${indent}  • Captures: ${captured.join(", ")}`);
            } else {
              log(`${indent}  • Captures: (none)`);
            }
          } else {
            log(`${indent}  • Captures: (not available in static breakdown)`);
          }

          return "[ArrowFunction]";
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

  /**
   * addExpressionEval
   *
   * When an expression is evaluated, the evaluator calls this to attach:
   * - serialized result
   * - textual breakdown and friendly explanation
   * - if the result is a user function, record captured variables & function signature into metadata (normalized)
   */
  addExpressionEval(expr: any, value: any, customBreakdown?: string[]) {
    const target = this.pendingEntry ?? this.entries[this.entries.length - 1];
    if (!target || !expr) return;

    let exprString = "<expr>";
    try {
      exprString = expr.range ? this.code.substring(expr.range[0], expr.range[1]) : expr.type || "<expr>";
    } catch {
      exprString = expr.type || "<expr>";
    }

    if (!target.expressionEval) target.expressionEval = {};

    // Pass the evaluated value to the breakdown builder so we can show captures for functions.
    const breakdown = (customBreakdown ?? this.buildExpressionBreakdown(expr, value)).map(line => typeof line === "string" ? line : String(line));

    let friendly: string[];
    try {
      friendly = this.makeFriendlyExplanation(expr, value).map(x => typeof x === "string" ? x : String(x));
    } catch {
      friendly = [`Expression result: ${value}`];
    }

    target.expressionEval[exprString] = {
      result: this.safeExpressionResult(value),
      breakdown,
      friendly,
    };

    // NEW: If the evaluated value is a user function, record its captured variables + signature + step index in metadata
    try {
      if (isUserFunctionValue(value)) {
        const captured = this.extractCapturedVariables(value);
        target.captured = captured;
        const metaPartial: Partial<TimelineEntry["metadata"]> = {
          capturedVariables: captured,
          capturedAtStep: (target.step as number) || undefined,
          kind: "ClosureCreated",
        };

        // Try set readable signature & functionName
        try {
          const sig = value && value.__node ? (value.__node.range ? this.code.substring(value.__node.range[0], value.__node.range[1]) : (value.__node.id?.name ? `function ${value.__node.id.name}` : "(arrow closure)")) : undefined;
          if (sig) metaPartial.signature = sig;
          metaPartial.functionName = value.__node?.id?.name || (value.__node?.type === "ArrowFunctionExpression" ? "(arrow closure)" : undefined);
        } catch {}

        // merge normalized metadata
        target.metadata = { ...(target.metadata || {}), ...(this.normalizeMetadata(metaPartial) as any) };
      }
    } catch {
      // ignore extraction errors
    }
  }

  addExpressionContext(expr: any, context: string) {
    const target = this.pendingEntry ?? this.entries[this.entries.length - 1];
    if (!target || !expr) return;
    const exprString = expr.range ? this.code.substring(expr.range[0], expr.range[1]) : expr.type || "<expr>";
    if (!target.expressionEval) target.expressionEval = {};
    if (!target.expressionEval[exprString]) target.expressionEval[exprString] = { result: undefined, breakdown: [] };
    target.expressionEval[exprString].context = context;
  }

  /**
   * logOutput
   *
   * Records console output in timeline + sets normalized metadata.consoleOutput
   */
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
    const target = this.pendingEntry ?? this.entries[this.entries.length - 1];
    if (target) {
      if(!target.output) target.output = [];
      target.output.push(text);
      // mark console output metadata — normalize to consoleOutput while keeping backward alias outputText
      const metaPartial: Partial<TimelineEntry["metadata"]> = {
        kind: "ConsoleOutput",
        consoleOutput: text,
        // keep old alias for backward compatibility
        outputText: text,
        callDepth: this.getStack().length
      };
      target.metadata = { ...(target.metadata || {}), ...(this.normalizeMetadata(metaPartial) as any) };
    }
  }

  getTimeline(): TimelineEntry[] {
    this.commitPendingEntry();
    return this.entries;
  }
}

The user has reverted their codebase to an earlier version. Retain prior prompts for context and reasoning, but do not apply code changes made in earlier prompts, as those are no longer valid.
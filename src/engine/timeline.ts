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
}

function isUserFunctionValue(value: any) {
  return value && typeof value === "object" && value.__isFunctionValue === true;
}

/* -------------------------------------------------------------
   SAFEST SERIALIZER AVAILABLE — 0% chance of circular crashes
------------------------------------------------------------- */

function safeJson(val: any): string {
  if (val === null || val === undefined) return String(val);
  const t = typeof val;

  if (t === "string") return JSON.stringify(val);
  if (t === "number" || t === "boolean") return String(val);

  if (isUserFunctionValue(val)) return "[Function]";
  if (t === "function") return "[NativeFunction]";

  if (Array.isArray(val)) return `[Array(${val.length})]`;

  try {
    return "[Object]";
  } catch {
    return "[Unprintable]";
  }
}

/* -------------------------------------------------------------
   TIMELINE LOGGER
------------------------------------------------------------- */

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

  getCode() {
    return this.code;
  }

  setCurrentEnv(env: LexicalEnvironment) {
    this.getEnvSnapshot = () => env;
  }

  /* -------------------------------------------------------------
     SANITIZE ENVIRONMENT
  ------------------------------------------------------------- */
  private safeSerializeEnv(envSnapshot: any): Record<string, any> {
    const out: Record<string, any> = {};
    if (!envSnapshot) return out;

    const frames = Array.isArray(envSnapshot)
      ? envSnapshot
      : Object.values(envSnapshot);

    const HIDE = new Set([
      "Math",
      "JSON",
      "Number",
      "String",
      "Boolean",
      "Object",
      "Array",
      "Function",
      "Date",
      "Promise",
      "RegExp",
      "Error",
      "Set",
      "Map",
      "WeakMap",
      "WeakSet",
      "Reflect",
      "Proxy",
      "console",
      "__proto__",
      "__env",
      "__params",
      "__body",
      "bindings",
      "outer",
      "record",
    ]);

    for (const frame of frames) {
      if (!frame) continue;

      const name = (frame as any).name || "Global";
      const bindings =
        (frame as any).bindings ??
        (typeof frame === "object" ? frame : {});

      const cleaned: Record<string, any> = {};

      for (const key of Object.keys(bindings)) {
        if (HIDE.has(key)) continue;

        try {
          cleaned[key] = this.safeExpressionResult(bindings[key]);
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

  /* -------------------------------------------------------------
     DIFF CALCULATION
  ------------------------------------------------------------- */
  private computeDiff(prev: any, curr: any): DiffSnapshot {
    const diff: DiffSnapshot = {
      added: {},
      changed: {},
      removed: {},
    };

    if (!prev) {
      for (const scope of Object.keys(curr)) {
        const vars = curr[scope];
        for (const k of Object.keys(vars)) {
          diff.added[`${scope}.${k}`] = vars[k];
        }
      }
      return diff;
    }

    // Added & changed
    for (const scope of Object.keys(curr)) {
      const currVars = curr[scope];
      const prevVars = prev[scope] || {};

      for (const k of Object.keys(currVars)) {
        const id = `${scope}.${k}`;
        if (!(scope in prev) || !(k in prevVars)) {
          diff.added[id] = currVars[k];
        } else {
          const before = JSON.stringify(prevVars[k]);
          const after = JSON.stringify(currVars[k]);
          if (before !== after) {
            diff.changed[id] = { from: prevVars[k], to: currVars[k] };
          }
        }
      }
    }

    // Removed
    for (const scope of Object.keys(prev)) {
      const prevVars = prev[scope];
      const currVars = curr[scope] || {};

      for (const k of Object.keys(prevVars)) {
        if (!(k in currVars)) {
          diff.removed[`${scope}.${k}`] = prevVars[k];
        }
      }
    }

    return diff;
  }

  /* -------------------------------------------------------------
     MAIN STEP LOGGER
  ------------------------------------------------------------- */
  log(line: number) {
    if (this.step > this.maxSteps) {
      throw new Error("Step limit exceeded");
    }

    let envSnap;
    try {
      const env = this.getEnvSnapshot();
      envSnap = (env as any).snapshotChain
        ? env.snapshotChain()
        : env;
    } catch {
      envSnap = {};
    }

    const vars = this.safeSerializeEnv(envSnap);
    const diff = this.computeDiff(this.lastVars, vars);
    this.lastVars = vars;

    const entry: TimelineEntry = {
      step: this.step++,
      line,
      variables: vars,
      heap: {},
      stack: [...this.getStack()],
      output: [...this.output],
      diff,
    };

    this.entries.push(entry);
  }

  /* -------------------------------------------------------------
     NEXT STEP / CONTROL FLOW
  ------------------------------------------------------------- */
  setNext(line: number | null, message: string, entry?: TimelineEntry) {
    const target = entry ?? this.entries[this.entries.length - 1];
    if (!target) return;
    target.nextStep = { line, message };
  }

  addFlow(message: string) {
    const last = this.entries[this.entries.length - 1];
    if (!last) return;
    if (!last.controlFlow) last.controlFlow = [];
    last.controlFlow.push(message);
  }

  /* -------------------------------------------------------------
     SAFE EXPRESSION RESULT
  ------------------------------------------------------------- */
  private safeExpressionResult(val: any): any {
    if (val === null || val === undefined) return val;

    const t = typeof val;

    if (t === "string" || t === "number" || t === "boolean") return val;
    if (isUserFunctionValue(val)) return "[Function]";
    if (t === "function") return "[NativeFunction]";

    if (Array.isArray(val)) {
      return val.map((v) => this.safeExpressionResult(v));
    }

    if (t === "object") {
      const out: Record<string, any> = {};
      for (const k of Object.keys(val).slice(0, 5)) {
        out[k] = this.safeExpressionResult(val[k]);
      }
      return out;
    }

    return String(val);
  }

  /* -------------------------------------------------------------
     EXPRESSION BREAKDOWN (short, safe, predictable)
  ------------------------------------------------------------- */
  private buildExpressionBreakdown(expr: any): string[] {
    const out: string[] = [];

    const walk = (node: any, indent = ""): any => {
      if (!node) return;

      const log = (msg: string) => out.push(indent + msg);

      switch (node.type) {
        case "Identifier":
          log(`Identifier "${node.name}"`);
          return;

        case "Literal":
          log(`Literal ${JSON.stringify(node.value)}`);
          return;

        case "BinaryExpression":
          log(`BinaryExpression (${node.operator})`);
          walk(node.left, indent + "  ");
          walk(node.right, indent + "  ");
          return;
        
        case "ArrowFunctionExpression": {
            log("Arrow Function:");
            log(indent + `  Parameters: (${node.params.map((p:any) => p.name).join(", ")})`);
            log(indent + `  Body: ${this.getCode()?.substring(node.body.range[0], node.body.range[1])}`);
            return "[Function]";
        }

        default:
          log(`Unsupported node: ${node.type}`);
          return;
      }
    };

    try {
      walk(expr);
    } catch {
      out.push("(error generating breakdown)");
    }

    return out;
  }

  private makeFriendlyExplanation(expr: any, result: any): string[] {
    return [`Expression result: ${safeJson(result)}`];
  }

  /* -------------------------------------------------------------
     STORE EXPRESSION EVAL OUTPUT
  ------------------------------------------------------------- */
  addExpressionEval(expr: any, value: any) {
    const last = this.entries[this.entries.length - 1];
    if (!last) return;

    if (!last.expressionEval) last.expressionEval = {};

    const key =
      expr.range
        ? this.code.substring(expr.range[0], expr.range[1])
        : expr.type || "<expr>";

    last.expressionEval[key] = {
      result: this.safeExpressionResult(value),
      breakdown: this.buildExpressionBreakdown(expr),
      friendly: this.makeFriendlyExplanation(expr, value),
    };
  }

  addExpressionContext(expr: any, ctx: string) {
    const last = this.entries[this.entries.length - 1];
    if (!last) return;

    const key =
      expr.range
        ? this.code.substring(expr.range[0], expr.range[1])
        : expr.type || "<expr>";

    if (!last.expressionEval) last.expressionEval = {};
    if (!last.expressionEval[key]) {
      last.expressionEval[key] = { result: undefined, breakdown: [] };
    }

    last.expressionEval[key].context = ctx;
  }

  /* -------------------------------------------------------------
     OUTPUT LOGGING
  ------------------------------------------------------------- */
  logOutput(...args: any[]) {
    const text = args
      .map((v) => {
        try {
          return safeJson(v);
        } catch {
          return "[Unprintable]";
        }
      })
      .join(" ");

    this.output.push(text);

    const last = this.entries[this.entries.length - 1];
    if (last) last.output = [...this.output];
  }

  /* -------------------------------------------------------------
     GET TIMELINE
  ------------------------------------------------------------- */
  getTimeline() {
    return this.entries;
  }
}

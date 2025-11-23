
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
}

function isUserFunction(value: any) {
  return value && typeof value === "object" && value.__isFunctionObject === true;
}

export class TimelineLogger {
  private entries: TimelineEntry[] = [];
  private step = 0;
  private output: string[] = [];

  constructor(
    private getEnvSnapshot: () => LexicalEnvironment,
    private getStack: () => string[],
    private code: string
  ) {}

  setCurrentEnv(env: LexicalEnvironment) {
    this.getEnvSnapshot = () => env;
  }

  log(line: number) {
    const env = this.getEnvSnapshot();
    const rawVars = env.snapshotChain(); // your existing method

    const serializedVars = JSON.parse(
      JSON.stringify(rawVars, (key, value) => {
        if (isUserFunction(value)) return "[Function]";
        if (typeof value === "function") return "[NativeFunction]";

        if (
          key === "__env" ||
          key === "__body" ||
          key === "__params" ||
          key === "__proto__" ||
          key === "outer" ||
          key === "record"
        ) {
          return undefined;
        }

        return value;
      })
    );

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

  // ---------- CONTROL FLOW NARRATION ----------

  addFlow(message: string) {
    const last = this.entries[this.entries.length - 1];
    if (!last) return;
    if (!last.controlFlow) last.controlFlow = [];
    last.controlFlow.push(message);
  }

  // ---------- EXPRESSION EVALUATION ----------

  private safeValue(name: string): any {
    try {
      const env = this.getEnvSnapshot();
      return (env as any).get?.(name) ?? undefined;
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

  private buildExpressionBreakdown(expr: any): string[] {
    const lines: string[] = [];

    const walk = (node: any): any => {
      switch (node.type) {
        case "Identifier": {
          const v = this.safeValue(node.name);
          lines.push(`${node.name} = ${v}`);
          return v;
        }
        case "Literal": {
          lines.push(`literal ${node.value}`);
          return node.value;
        }
        case "BinaryExpression": {
          const left = walk(node.left);
          const right = walk(node.right);
          const result = this.applyOperator(left, right, node.operator);
          lines.push(`${left} ${node.operator} ${right} = ${result}`);
          return result;
        }
        default:
          return undefined;
      }
    };

    walk(expr);
    return lines;
  }

  private friendlyText(op: string) {
    switch (op) {
      case "%": return "finding the remainder";
      case "==":
      case "===": return "checking if the two values are equal";
      case "!=":
      case "!==": return "checking if the two values are NOT equal";
      case "<": return "checking if left is less than right";
      case ">": return "checking if left is greater than right";
      case "<=": return "checking if left is less than or equal to right";
      case ">=": return "checking if left is greater than or equal to right";
      case "+": return "adding the two values";
      case "-": return "subtracting right from left";
      case "*": return "multiplying the two values";
      case "/": return "dividing left by right";
      default: return `evaluating operator '${op}'`;
    }
  }

  private makeFriendlyExplanation(expr: any, result: any): string[] {
    if (expr.type !== "BinaryExpression") {
      return [`Expression result: ${result}`];
    }

    const op = expr.operator;
    const opText = this.friendlyText(op);

    const leftName =
      expr.left.type === "Identifier"
        ? expr.left.name
        : this.code.substring(expr.left.range?.[0] ?? 0, expr.left.range?.[1] ?? 0);
    const rightName =
      expr.right.type === "Identifier"
        ? expr.right.name
        : this.code.substring(expr.right.range?.[0] ?? 0, expr.right.range?.[1] ?? 0);

    const leftVal = this.safeValue(expr.left.name ?? leftName);
    const rightVal = this.safeValue(expr.right.name ?? rightName);

    const lines: string[] = [];

    const exprString = this.code.substring(expr.range?.[0] ?? 0, expr.range?.[1] ?? 0);
    lines.push(`Expression: ${exprString}`);
    if (leftName) lines.push(`${leftName} is ${leftVal}`);
    if (rightName) lines.push(`${rightName} is ${rightVal}`);

    if (op === "%") {
      lines.push(`${leftVal} % ${rightVal} gives remainder ${this.applyOperator(leftVal, rightVal, "%")}`);
    }

    if (["==", "===", "!=", "!=="].includes(op)) {
      lines.push(`Left side = ${leftVal}`);
      lines.push(`Right side = ${rightVal}`);
      lines.push(`Comparison result → ${result}`);
    } else if (["<", "<=", ">", ">="].includes(op)) {
      lines.push(`Is ${leftVal} ${op} ${rightVal}? → ${result}`);
    } else {
      lines.push(`${leftVal} ${op} ${rightVal} = ${result}`);
    }

    lines.push(`Final Result: ${result}`);

    return lines;
  }

  addExpressionEval(expr: any, value: any) {
    const last = this.entries[this.entries.length - 1];
    if (!last || !expr.range) return;

    const exprString = this.code.substring(expr.range[0], expr.range[1]);
    if (!last.expressionEval) last.expressionEval = {};

    const breakdown = this.buildExpressionBreakdown(expr);
    const friendly = this.makeFriendlyExplanation(expr, value);

    last.expressionEval[exprString] = {
      result: value,
      breakdown,
      friendly,
    };
  }

  addExpressionContext(expr: any, context: string) {
    const last = this.entries[this.entries.length - 1];
    if (!last || !expr.range) return;

    const exprString = this.code.substring(expr.range[0], expr.range[1]);
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
        if (typeof arg === "object" && arg !== null) {
          try {
            return JSON.stringify(arg);
          } catch {
            return "[Circular]";
          }
        }
        return String(arg);
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

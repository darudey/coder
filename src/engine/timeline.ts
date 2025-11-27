
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

  log(line: number) {
    if (this.step >= this.maxSteps) {
      throw new Error("Step limit exceeded");
    }

    const env = this.getEnvSnapshot();
    const rawVars = env.snapshotChain();

    const serializedVars = JSON.parse(
      JSON.stringify(rawVars, (key, value) => {
        if (value === undefined) {
          return "[undefined]";
        }
        
        if (key === 'Math' && value && Object.keys(value).length > 0) {
            const mathObject: {[key: string]: any} = {};
            for (const prop of Object.getOwnPropertyNames(Math)) {
                const mathProp = (Math as any)[prop];
                if (typeof mathProp === 'function') {
                    mathObject[prop] = '[NativeFunction]';
                } else {
                    mathObject[prop] = mathProp;
                }
            }
            return mathObject;
        }

        if (isUserFunctionValue(value)) return "[Function]";
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
    
    // Replace placeholder string with actual undefined
    const finalVars = JSON.parse(JSON.stringify(serializedVars).replace(/"\[undefined\]"/g, 'undefined'));

    const entry: TimelineEntry = {
      step: this.step++,
      line,
      variables: finalVars,
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
      if (!node) return;
      
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
          log(`Binary Expression: ${node.operator}`);
          const left = walk(node.left, indent + "  ");
          const right = walk(node.right, indent + "  ");
          const result = this.applyOperator(left, right, node.operator);
          log(`Result → ${JSON.stringify(result)}`);
          return result;
        }
        case "MemberExpression": {
            log(`Member Access:`);
            const obj = walk(node.object, indent + "  ");
            let prop;
            if (node.computed) {
                prop = walk(node.property, indent + "  ");
            } else {
                prop = node.property.name;
                log(`${indent}  Property: "${prop}"`);
            }
            if(obj === undefined || obj === null) {
                log(`Cannot read property of ${obj}`);
                return undefined;
            }
            const result = obj[prop];
            log(`Result → ${JSON.stringify(result)}`);
            return result;
        }
         case "CallExpression": {
            log(`Function Call:`);
            walk(node.callee, indent + "  ");
            log(`Arguments:`);
            node.arguments.forEach((arg: any) => walk(arg, indent + "    "));
            log(`(Result not simulated in breakdown)`);
            return "[Function Call]";
        }
        default:
          log(`(Unsupported node type: ${node.type})`);
          return undefined;
      }
    };

    walk(expr);
    return lines;
  }

  private makeFriendlyExplanation(expr: any, result: any): string[] {
    if (expr.type !== "BinaryExpression") {
      return [`Expression result: ${result}`];
    }

    const op = expr.operator;
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
      lines.push(
        `${leftVal} % ${rightVal} gives remainder ${this.applyOperator(
          leftVal,
          rightVal,
          "%"
        )}`
      );
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

  addExpressionEval(expr: any, value: any, customBreakdown?: string[]) {
    const last = this.entries[this.entries.length - 1];
    if (!last || !expr.range) return;

    const exprString = this.code.substring(expr.range[0], expr.range[1]);
    if (!last.expressionEval) last.expressionEval = {};
    
    const breakdown = customBreakdown || this.buildExpressionBreakdown(expr);
    const friendly = this.makeFriendlyExplanation(expr, value);

    last.expressionEval[exprString] = {
      result: value,
      breakdown: breakdown,
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

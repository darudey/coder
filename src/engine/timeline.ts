
// src/engine/timeline.ts
import type { LexicalEnvironment } from "./environment";

export interface TimelineEntry {
  step: number;
  line: number;
  variables: Record<string, any>;
  heap: Record<string, any>;
  stack: string[];
  output: string[];
  expressionEval?: Record<string, {
    result: any;
    breakdown: string[];
    context?: string;
  }>;
}

function isUserFunction(value: any) {
    return value && typeof value === "object" && value.__isFunctionObject === true;
}

export class TimelineLogger {
  private entries: TimelineEntry[] = [];
  private step = 0;
  private output: string[] = [];

  constructor(private getEnvSnapshot: () => LexicalEnvironment, private getStack: () => string[], private code: string) {}
  
  setCurrentEnv(env: LexicalEnvironment) {
    this.getEnvSnapshot = () => env;
  }

  log(line: number) {
    const env = this.getEnvSnapshot();
    const rawVars = env.snapshotChain();

    const serializedVars = JSON.parse(
      JSON.stringify(rawVars, (key, value) => {
        // Hide user-defined functions
        if (isUserFunction(value)) return '[Function]';

        // Hide real functions (console.log etc.)
        if (typeof value === 'function') return '[NativeFunction]';

        // Prevent circular structures and internal properties
        if (key === '__env' || key === '__body' || key === '__params' || key === '__proto__' || key === 'outer' || key === 'record') {
            return undefined;
        }

        return value;
      })
    );

    const entry: TimelineEntry = {
      step: this.step++,
      line,
      variables: serializedVars,
      heap: {}, // For now, heap is not tracked, but the structure is here.
      stack: [...this.getStack()],
      output: [...this.output]
    };

    this.entries.push(entry);
  }

  private safeValue(name: string): any {
    try {
      const env = this.getEnvSnapshot();
      return env.get(name);
    } catch {
      return undefined;
    }
  }

  private applyOperator(l: any, r: any, op: string): any {
    switch (op) {
      case '+': return l + r;
      case '-': return l - r;
      case '*': return l * r;
      case '/': return l / r;
      case '%': return l % r;
      case '==': return l == r;
      case '===': return l === r;
      case '<': return l < r;
      case '>': return l > r;
      case '<=': return l <= r;
      case '>=': return l >= r;
      default:
        return undefined;
    }
  }
  
  private buildExpressionBreakdown(expr: any): string[] {
    const lines: string[] = [];
  
    const walk = (node: any): any => {
      switch (node.type) {
        case 'Identifier': {
          const v = this.safeValue(node.name);
          lines.push(`${node.name} = ${v} (${typeof v})`);
          return v;
        }
        case 'Literal':
          lines.push(`Literal (${typeof node.value}) ${node.value}`);
          return node.value;
  
        case 'BinaryExpression': {
          const left = walk(node.left);
          const right = walk(node.right);
          const result = this.applyOperator(left, right, node.operator);
          lines.push(`${left} ${node.operator} ${right}  →  ${result}`);
          return result;
        }
  
        default:
          return undefined;
      }
    };
  
    walk(expr);
    return lines;
  }

  addExpressionEval(expr: any, value: any) {
    const last = this.entries[this.entries.length - 1];
    if (!last || !expr.range) return;
    
    const exprString = this.code.substring(expr.range[0], expr.range[1]);
  
    if (!last.expressionEval) last.expressionEval = {};
  
    const breakdown = this.buildExpressionBreakdown(expr);
  
    last.expressionEval[exprString] = {
      result: value,
      breakdown
    };
  }

  addExpressionContext(expr: any, context: string) {
    const last = this.entries[this.entries.length - 1];
    if (!last || !expr.range) return;

    const exprString = this.code.substring(expr.range[0], expr.range[1]);

    if (!last.expressionEval) last.expressionEval = {};
    if (!last.expressionEval[exprString])
      last.expressionEval[exprString] = { result: undefined, breakdown: [] };

    last.expressionEval[exprString].context = context;
  }

  logOutput(...args: any[]) {
    const text = args
      .map((arg) => {
        if (typeof arg === "object" && arg !== null) {
          try {
            // A simple stringify, might need more robust handling for custom values later
            return JSON.stringify(arg);
          } catch {
            return "[Circular]";
          }
        }
        return String(arg);
      })
      .join(" ");
    this.output.push(text);
    
    // Also update the last entry to reflect the output at that step
    const last = this.entries[this.entries.length - 1];
    if (last) {
      last.output = [...this.output];
    }
  }

  getTimeline(): TimelineEntry[] {
    return this.entries;
  }
}

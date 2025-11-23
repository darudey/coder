// src/engine/timeline.ts
import type { LexicalEnvironment } from "./environment";

export interface TimelineEntry {
  step: number;
  line: number;
  variables: Record<string, any>;
  heap: Record<string, any>;
  stack: string[];
  output: string[];
  expressionEval?: Record<string, any>;
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

  addExpressionEval(expr: any, value: any) {
    const last = this.entries[this.entries.length - 1];
    if (!last || !expr.loc) return;
  
    const exprString = this.code.substring(expr.range[0], expr.range[1]);
  
    if (!last.expressionEval) last.expressionEval = {};
    last.expressionEval[exprString] = value;
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

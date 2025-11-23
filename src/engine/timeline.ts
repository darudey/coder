// src/engine/timeline.ts
import type { LexicalEnvironment } from "./environment";

export interface TimelineEntry {
  step: number;
  line: number;
  variables: Record<string, any>;
  heap: Record<string, any>;
  stack: string[];
  output: string[];
}

export class TimelineLogger {
  private entries: TimelineEntry[] = [];
  private step = 0;
  private output: string[] = [];

  constructor(private getEnvSnapshot: () => LexicalEnvironment, private getStack: () => string[]) {}

  log(line: number) {
    const env = this.getEnvSnapshot();
    const rawVars = env.snapshotChain();

    const serializedVars = JSON.parse(
      JSON.stringify(rawVars, (key, value) => {
        if (typeof value === "function") return "[Function]";
        // Later, we can add more complex serialization for our custom FunctionValue if needed
        if (typeof value === 'object' && value !== null && value.__isFunctionValue) {
          return "[Function]";
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

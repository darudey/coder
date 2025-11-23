// src/engine/interpreter.ts

import * as esprima from "esprima-next";
import { LexicalEnvironment } from "./environment";
import { TimelineLogger, TimelineEntry } from "./timeline";
import { evaluateProgram } from "./evaluator";
import { createObject } from "./values";

export class Interpreter {
  private globalEnv: LexicalEnvironment;
  private logger: TimelineLogger;
  private stack: string[] = [];
  private currentEnv: LexicalEnvironment;

  constructor(private code: string) {
    this.globalEnv = LexicalEnvironment.newGlobal();
    const scriptEnv = this.globalEnv.extend("Script", "script");
    this.currentEnv = scriptEnv;

    this.logger = new TimelineLogger(
      () => this.currentEnv,
      () => this.stack,
      this.code
    );

    this.setupGlobalBindings();
  }

  private setupGlobalBindings() {
    // console.log
    const consoleObj: any = createObject(null);
    const logFn = (...args: any[]) => {
      this.logger.logOutput(...args);
    };
    (logFn as any).__builtin = "console.log";
    consoleObj.log = logFn;
    
    this.globalEnv.record.createMutableBinding("console", "var", consoleObj, true);

    // Math object
    this.globalEnv.record.createMutableBinding("Math", "var", Math, true);
  }

  run(): TimelineEntry[] {
    try {
      const ast = esprima.parseScript(this.code, {
        loc: true,
        range: true,
      });

      evaluateProgram(ast as any, {
        env: this.currentEnv,
        thisValue: undefined,
        logger: this.logger,
        stack: this.stack
      });
    } catch (e: any) {
      this.logger.logOutput("Error:", e.message ?? String(e));
    }

    return this.logger.getTimeline();
  }
}

export function generateTimeline(code: string): TimelineEntry[] {
  const interpreter = new Interpreter(code);
  return interpreter.run();
}
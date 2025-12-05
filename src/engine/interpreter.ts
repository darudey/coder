// src/engine/interpreter.ts
//
// FINAL PHASE-2 + STEP INDEX SUPPORT
//

import * as acorn from "acorn";
import { LexicalEnvironment, EnvironmentRecord } from "./environment";
import { TimelineLogger, TimelineEntry } from "./timeline";
import { evaluateProgram, EvalContext } from "./evaluator";
import { createObject } from "./values";
import { resetCallCounter } from "./expressions/evalCall";

export interface RunOptions {
  maxSteps?: number;
}

export interface RunMetadata {
  indexByStep: Record<number, number>;
}

export function generateTimeline(
  code: string,
  options: RunOptions = {}
): TimelineEntry[] & { meta: RunMetadata } {
  const maxSteps = options.maxSteps ?? 2000;

  resetCallCounter();

  // --- PARSE ---
  let ast;
  try {
    ast = acorn.parse(code, {
      ecmaVersion: "latest",
      locations: true,
      ranges: true,
      sourceType: "script",
    }) as any;
  } catch (e: any) {
    const arr: any = [
      {
        step: 0,
        line: (e.loc?.line ?? 1) - 1,
        variables: {},
        heap: {},
        stack: [],
        output: [`SyntaxError: ${e.message}`],
        nextStep: {
          line: null,
          message: "Execution failed due to a syntax error.",
        },
      }
    ];
    arr.meta = { indexByStep: { 0: 0 } };
    return arr;
  }

  // --- GLOBAL ENV ---
  const globalRecord = new EnvironmentRecord();
  const globalEnv = new LexicalEnvironment("Global", "global", globalRecord, null);
  const scriptEnv = globalEnv.extend("script", "Script");

  const stack: string[] = [];
  const logger = new TimelineLogger(
    () => scriptEnv,
    () => stack,
    code,
    maxSteps
  );

  // --- BUILTINS ---
  const consoleObj: any = createObject(null);
  const logFn = (...args: any[]) => logger.logOutput(...args);
  (logFn as any).__builtin = "console.log";
  consoleObj.log = logFn;
  globalEnv.record.createMutableBinding("console", "var", consoleObj, true);
  globalEnv.record.createMutableBinding("Math", "var", Math, true);

  const ctx: EvalContext = {
    env: scriptEnv,
    thisValue: undefined,
    logger,
    stack,
  };

  // --- EXECUTE ---
  try {
    evaluateProgram(ast, ctx);
  } catch (err: any) {
    const entries = logger.getTimeline();
    const last = entries.at(-1);
    const lastStep = (last?.step ?? 0) + 1;

    entries.push({
      step: lastStep,
      line: last?.line ?? 0,
      variables: globalEnv.snapshotChain(),
      heap: {},
      stack: [...stack],
      output: last ? [...last.output] : [],
      controlFlow: [],
      expressionEval: {},
      nextStep: {
        line: null,
        message:
          err?.message === "Step limit exceeded"
            ? "Execution stopped: too many steps (possible infinite loop)"
            : `Execution error: ${err?.message ?? String(err)}`,
      },
    } as TimelineEntry);

    const arr: any = [...entries];
    const index: Record<number, number> = {};
    arr.forEach((e: any, idx: number) => (index[e.step] = idx));
    arr.meta = { indexByStep: index };

    return arr;
  }

  // --- FINAL STEP ---
  const last = logger.peekLastStep();
  if (last && stack.length === 0) {
    logger.log(last.line);
    logger.addFlow("Program finished ✔");
    logger.setNext(null, "No more steps");
  }

  const arr: any = logger.getTimeline();
  const index: Record<number, number> = {};
  arr.forEach((e: any, idx: number) => (index[e.step] = idx));
  arr.meta = { indexByStep: index };

  return arr;
}


// src/engine/interpreter.ts
//
// FINAL PHASE-2 VERSION
// • Resets CALL_COUNTER each run
// • Adds universal “Program finished ✔” step
// • Teaching-friendly builtins
// • No duplicate steps
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

export function generateTimeline(
  code: string,
  options: RunOptions = {}
): TimelineEntry[] {
  const maxSteps = options.maxSteps ?? 2000;

  // 🔥 PHASE 2: Always reset call counter before execution
  resetCallCounter();

  // --------------------------------------------------------------
  // 1. PARSE
  // --------------------------------------------------------------
  let ast;
  try {
    ast = acorn.parse(code, {
      ecmaVersion: "latest",
      locations: true,
      ranges: true,
      sourceType: "script",
    }) as any;
  } catch (e: any) {
    // Return a timeline with a single syntax-error step
    const errorEntry: TimelineEntry = {
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
    };
    return [errorEntry];
  }

  // --------------------------------------------------------------
  // 2. GLOBAL ENVIRONMENT
  // --------------------------------------------------------------
  const globalRecord = new EnvironmentRecord();
  const globalEnv = new LexicalEnvironment(
    "Global",
    "global",
    globalRecord,
    null
  );

  const scriptEnv = globalEnv.extend("script", "Script");

  const stack: string[] = [];
  const logger = new TimelineLogger(
    () => scriptEnv,
    () => stack,
    code,
    maxSteps
  );

  // --------------------------------------------------------------
  // 3. BUILTINS (teaching-friendly)
  // --------------------------------------------------------------
  const consoleObj: any = createObject(null);

  const logFn = (...args: any[]) => {
    logger.logOutput(...args);
  };
  (logFn as any).__builtin = "console.log"; // needed by evalCall
  consoleObj.log = logFn;

  globalEnv.record.createMutableBinding("console", "var", consoleObj, true);
  globalEnv.record.createMutableBinding("Math", "var", Math, true);

  // --------------------------------------------------------------
  // 4. CONTEXT
  // --------------------------------------------------------------
  const ctx: EvalContext = {
    env: scriptEnv,
    thisValue: undefined,
    logger,
    stack,
  };

  // --------------------------------------------------------------
  // 5. EXECUTE PROGRAM
  // --------------------------------------------------------------
  try {
    evaluateProgram(ast, ctx);
  } catch (err: any) {
    // Step-limit or runtime error
    const entries = logger.getTimeline();
    const lastEntry = entries.at(-1);
    const lastStep = (lastEntry?.step ?? 0) + 1;
    const lastLine = lastEntry?.line ?? 0;

    const extra: TimelineEntry = {
      step: lastStep,
      line: lastLine,
      variables: globalEnv.snapshotChain(),
      heap: {},
      stack: [...stack],
      output: lastEntry ? [...lastEntry.output] : [],
      controlFlow: [],
      expressionEval: {},
      nextStep: {
        line: null,
        message:
          err?.message === "Step limit exceeded"
            ? "Execution stopped: too many steps (possible infinite loop)"
            : `Execution error: ${err?.message ?? String(err)}`,
      },
    };

    entries.push(extra);
    return entries;
  }

  // --------------------------------------------------------------
  // 6. UNIVERSAL FINAL STEP (Phase-2 requirement)
  // --------------------------------------------------------------
  const last = logger.peekLastStep();

  // Only add finishing line if we returned to global
  if (last && stack.length === 0) {
    logger.log(last.line);
    logger.addFlow("Program finished ✔");
    logger.setNext(null, "No more steps");
  }

  // Done
  return logger.getTimeline();
}

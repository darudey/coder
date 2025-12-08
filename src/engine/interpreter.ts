
// src/engine/interpreter.ts
//
// FINAL PHASE-2 + UI metadata support (compatibility safe)
//

import * as acorn from "acorn";
import { LexicalEnvironment, EnvironmentRecord } from "./environment";
import { TimelineLogger, TimelineEntry } from "./timeline";
import { evaluateProgram, EvalContext } from "./evaluator";
import { createObject } from "./values";
import { resetCallCounter } from "./expressions/evalCall";
import { displayHeader } from "./next-step-helpers";


export interface RunOptions {
  maxSteps?: number;
}

export interface RunMetadata {
  indexByStep: Record<number, number>;
}

export function generateTimeline(
  code: string,
  options: RunOptions = {}
): TimelineEntry[] & { meta?: RunMetadata } {
  const maxSteps = options.maxSteps ?? 2000;

  // Always reset call counter before execution (Phase 2 rule)
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

    const arr: any = [errorEntry];
    arr.meta = { indexByStep: { 0: 0 } };
    return arr;
  }

  // --------------------------------------------------------------
  // 2. GLOBAL ENVIRONMENT
  // --------------------------------------------------------------
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

   // --- Step 0: Initial state before execution ---
  const firstMeaningfulStatement = ast.body.find((stmt: any) => stmt.type !== 'EmptyStatement' && stmt.type !== 'DebuggerStatement');
  
  // --------------------------------------------------------------
  // 4. CONTEXT
  // --------------------------------------------------------------
  const ctx: EvalContext = {
    env: scriptEnv,
    thisValue: undefined,
    logger,
    stack,
  };


  if (firstMeaningfulStatement) {
    logger.addFlow("Ready to run. Click Next to start.");
    logger.setNext(
        firstMeaningfulStatement.loc.start.line - 1,
        `Next Step → ${displayHeader(firstMeaningfulStatement, logger.getCode())}`
    );
  } else {
    logger.addFlow("Ready to run, but no code found.");
    logger.setNext(null, "End of program.");
  }


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

    const arr: any = [...entries];
    const indexByStep: Record<number, number> = {};
    arr.forEach((e: any, idx: number) => (indexByStep[e.step] = idx));
    arr.meta = { indexByStep };

    return arr;
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

  const timeline = logger.getTimeline();
  const arr: any = [...timeline];

  // Build step-index map
  const indexByStep: Record<number, number> = {};
  arr.forEach((e: any, idx: number) => (indexByStep[e.step] = idx));
  arr.meta = { indexByStep };

  return arr;
}

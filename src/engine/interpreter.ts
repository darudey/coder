// src/engine/interpreter.ts

import * as acorn from 'acorn';
import { LexicalEnvironment, EnvironmentRecord } from './environment';
import { TimelineLogger, TimelineEntry } from './timeline';
import { evaluateProgram, EvalContext } from './evaluator';
import { createObject } from './values';
import { resetCallCounter } from './expressions/evalCall';

export interface RunOptions {
  maxSteps?: number;
}

/**
 * Main entry: parse, setup global env, run, and return timeline.
 */
export function generateTimeline(
  code: string,
  options: RunOptions = {}
): TimelineEntry[] {
  const maxSteps = options.maxSteps ?? 2000;
  
  // RESET call counter before each program run
  resetCallCounter();

  let ast;
  try {
    ast = acorn.parse(code, {
      ecmaVersion: 'latest',
      locations: true,
      ranges: true,
      sourceType: 'script',
    }) as any;
  } catch (e: any) {
    const errorEntry: TimelineEntry = {
      step: 0,
      line: (e.loc?.line ?? 1) - 1,
      variables: {},
      heap: {},
      stack: [],
      output: [`SyntaxError: ${e.message}`],
      nextStep: {
        line: null,
        message: `Execution failed due to a syntax error.`,
      },
    };
    return [errorEntry];
  }

  // Global env
  const globalRecord = new EnvironmentRecord();
  const globalEnv = new LexicalEnvironment(
    'Global',
    'global',
    globalRecord,
    null
  );
  const scriptEnv = globalEnv.extend('script', 'Script');

  const stack: string[] = [];
  const logger = new TimelineLogger(
    () => scriptEnv,
    () => stack,
    code,
    maxSteps
  );

  // Builtins for teaching
  const consoleObj: any = createObject(null);
  const logFn = (...args: any[]) => {
    logger.logOutput(...args);
  };
  (logFn as any).__builtin = 'console.log';
  consoleObj.log = logFn;

  globalEnv.record.createMutableBinding('console', 'var', consoleObj, true);
  globalEnv.record.createMutableBinding('Math', 'var', Math, true);

  const ctx: EvalContext = {
    env: scriptEnv,
    thisValue: undefined,
    logger,
    stack,
  };

  try {
    evaluateProgram(ast, ctx);
  } catch (err: any) {
    // Step limit or other error
    const entries = logger.getTimeline();
    const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
    const lastStep = lastEntry ? lastEntry.step + 1 : 0;
    const lastLine = lastEntry ? lastEntry.line : 0;

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
          err && err.message === 'Step limit exceeded'
            ? 'Execution stopped: too many steps (possible infinite loop / recursion)'
            : `Execution error: ${err?.message ?? String(err)}`,
      },
    };

    entries.push(extra);
    return entries;
  }

  // ---- ADD UNIVERSAL FINAL STEP ----
  const last = logger.peekLastStep();
  if (last && stack.length === 0) {
    // Only add "finished" if we are back at the global scope.
    logger.log(last.line);
    logger.addFlow("Program finished ✔");
    logger.setNext(null, "No more steps");
  }

  return logger.getTimeline();
}

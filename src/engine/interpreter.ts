
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

  resetCallCounter();

  let ast;
  try {
    ast = acorn.parse(code, {
      ecmaVersion: "latest",
      locations: true,
      ranges: true,
      sourceType: "script",
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
        message: "Execution failed due to a syntax error.",
      },
    };

    const arr: any = [errorEntry];
    arr.meta = { indexByStep: { 0: 0 } };
    return arr;
  }

  // GLOBAL ENV
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

  // BUILTINS
  const consoleObj: any = createObject(null);
  const logFn = (...args: any[]) => logger.logOutput(...args);
  (logFn as any).__builtin = "console.log";
  consoleObj.log = logFn;

  globalEnv.record.createMutableBinding("console", "var", consoleObj, true);
  globalEnv.record.createMutableBinding("Math", "var", Math, true);

  // --- STEP 0 (critical!) ---
  logger.log(0, true);  

  // Determine first "real" executable line
  const firstMeaningful = ast.body.find(
    (n: any) => n.type !== "EmptyStatement" && n.type !== "DebuggerStatement"
  );

  if (firstMeaningful?.loc) {
    const preview = displayHeader(firstMeaningful, code);
    logger.addFlow("Ready to run. Click Next to start.");
    logger.setNext(
      firstMeaningful.loc.start.line - 1,
      `Next Step → ${preview} (line ${firstMeaningful.loc.start.line})`
    );
  }

  const ctx: EvalContext = {
    env: scriptEnv,
    thisValue: undefined,
    logger,
    stack,
  };

  // EXECUTION
  try {
    evaluateProgram(ast, ctx);
  } catch (err: any) {
    const entries = logger.getTimeline();
    const last = entries.at(-1);
    const step = (last?.step ?? 0) + 1;

    const extra: TimelineEntry = {
      step,
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
            ? "Execution stopped: too many steps"
            : `Execution error: ${err?.message ?? String(err)}`,
      },
    };

    entries.push(extra);

    const arr: any = [...entries];
    arr.meta = { indexByStep: Object.fromEntries(arr.map((e: any, i: number) => [e.step, i])) };
    return arr;
  }

  const lastStep = logger.peekLastStep();

  if (lastStep && stack.length === 0) {
    const lastSourceNode = ast.body[ast.body.length - 1];
    const finalLine = lastSourceNode?.loc?.end?.line - 1 ?? lastStep.line;
    logger.log(finalLine);
    logger.addFlow("Program finished ✔");
    logger.setNext(null, "No more steps");
  }

  const timeline = logger.getTimeline();
  const out: any = [...timeline];

  out.meta = {
    indexByStep: Object.fromEntries(out.map((e: any, i: number) => [e.step, i])),
  };

  return out;
}

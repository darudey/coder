
// src/engine/statements/evalWhile.ts
// Complete WhileStatement evaluator with correct next-step prediction

import { evaluateStatement, evaluateBlockBody } from "../evaluator";
import { evaluateExpression } from "../expressions";

import {
  isBreakSignal,
  isContinueSignal,
  isReturnSignal,
  isThrowSignal,
  makeBreak,
} from "../signals";

import {
  logIfRealStatement,
  displayHeader,
  getFirstMeaningfulStatement,
} from "../next-step-helpers";

import type { EvalContext } from "../types";

export function evalWhileStatement(node: any, ctx: EvalContext) {
  const loopEnv = ctx.env.extend("block");
  const loopCtx: EvalContext = { ...ctx, env: loopEnv };

  let iteration = 0;
  let result: any;

  while (true) {
    iteration++;

    // Use correct environment for loop body
    ctx.logger.setCurrentEnv(loopEnv);

    // --- Evaluate Condition ---
    logIfRealStatement(node.test, loopCtx);
    const test = evaluateExpression(node.test, { ...loopCtx, safe: true });

    ctx.logger.addExpressionEval(node.test, test);
    ctx.logger.addExpressionContext(node.test, "While Loop Condition");

    ctx.logger.addFlow("WHILE LOOP CHECK:");
    ctx.logger.addFlow(`Iteration #${iteration}`);
    ctx.logger.addFlow(test ? "TRUE → continue loop" : "FALSE → exit loop");

    if (!test) {
      // NEXT-STEP after WHILE exits
      ctx.logger.setNext(
        node.loc.end.line,
        `Exit WHILE loop → ${ctx.nextStatement ? displayHeader(ctx.nextStatement, ctx.logger.getCode()) : "End"}`
      );
      break;
    }

    // --- NEXT STEP: enter loop body ---
    const first = getFirstMeaningfulStatement(node.body);
    if (first) {
      ctx.logger.setNext(
        first.loc.start.line - 1,
        "Next Step → " + displayHeader(first, ctx.logger.getCode())
      );
    }

    // --- Execute Loop Body ---
    let bodyResult;
    if (node.body.type === "BlockStatement") {
      bodyResult = evaluateBlockBody(node.body.body, loopCtx);
    } else {
      bodyResult = evaluateStatement(node.body, loopCtx);
    }

    // --- Handle Control Signals ---
    if (isBreakSignal(bodyResult)) {
      if (!bodyResult.label) {
        ctx.logger.setNext(
          node.loc.end.line,
          `Break → exit WHILE loop. Next: ${ctx.nextStatement ? displayHeader(ctx.nextStatement, ctx.logger.getCode()) : "End"}`
        );
        break;
      } else {
        // labeled break bubbles up
        return bodyResult;
      }
    }

    if (isContinueSignal(bodyResult)) {
      // labeled continue must bubble up if mismatched
      if (bodyResult.label && (!ctx.labels || !ctx.labels[bodyResult.label])) {
        return bodyResult;
      }

      // continue → re-check condition
      continue;
    }

    if (isReturnSignal(bodyResult) || isThrowSignal(bodyResult)) {
      result = bodyResult;
      break;
    }
  }

  // Restore environment
  ctx.logger.setCurrentEnv(ctx.env);

  return result;
}

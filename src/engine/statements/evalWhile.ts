// src/engine/statements/evalWhile.ts

import type { EvalContext } from "../types";
import { evaluateExpression } from "../expressions";
import {
  isBreakSignal,
  isContinueSignal,
  isReturnSignal,
  isThrowSignal,
} from "../signals";
import { evaluateBlockBody, evaluateStatement } from "../evaluator";
import {
  displayHeader,
  getFirstMeaningfulStatement,
  safeEvaluate
} from "../next-step-helpers";

export function evalWhileStatement(node: any, ctx: EvalContext): any {
  const loopEnv = ctx.env.extend("block");
  const loopCtx: EvalContext = { ...ctx, env: loopEnv };

  let iteration = 0;
  let result: any;

  while (true) {
    iteration++;
    ctx.logger.setCurrentEnv(loopEnv);

    // STEP 🎯: condition is ALWAYS a separate step
    ctx.logger.log(node.test.loc.start.line - 1);

    // Safe preview for debugger explanation
    const preview = safeEvaluate(node.test, loopCtx);
    ctx.logger.addExpressionEval(node.test, preview);
    ctx.logger.addExpressionContext(node.test, "While Loop Condition");

    ctx.logger.addFlow(`WHILE CHECK (#${iteration})`);
    ctx.logger.addFlow(preview ? "TRUE → body" : "FALSE → exit");

    // REAL evaluation (side effects allowed)
    const test = evaluateExpression(node.test, loopCtx);

    if (!test) {
      if (ctx.nextStatement) {
        ctx.logger.setNext(
          ctx.nextStatement.loc.start.line - 1,
          `Exit WHILE → ${displayHeader(ctx.nextStatement, ctx.logger.getCode())}`
        );
      } else {
        ctx.logger.setNext(null, "Exit WHILE → end of block");
      }
      break;
    }

    // NEXT STEP → first body statement
    const firstBodyStmt =
      node.body.type === "BlockStatement"
        ? getFirstMeaningfulStatement(node.body)
        : node.body;

    if (firstBodyStmt) {
      ctx.logger.setNext(
        firstBodyStmt.loc.start.line - 1,
        `Next Step → ${displayHeader(firstBodyStmt, ctx.logger.getCode())}`
      );
    }

    // EXECUTE BODY (its own stepping)
    let bodyResult: any;
    if (node.body.type === "BlockStatement") {
      bodyResult = evaluateBlockBody(node.body.body, {
        ...loopCtx,
        nextStatement: undefined,
      });
    } else {
      bodyResult = evaluateStatement(node.body, loopCtx);
    }

    // HANDLE CONTROL SIGNALS
    if (isBreakSignal(bodyResult)) {
      if (!bodyResult.label) {
        if (ctx.nextStatement) {
          ctx.logger.setNext(
            ctx.nextStatement.loc.start.line - 1,
            `Break → exit WHILE → ${displayHeader(
              ctx.nextStatement,
              ctx.logger.getCode()
            )}`
          );
        } else {
          ctx.logger.setNext(null, "Break → exit WHILE → end of block");
        }
        break;
      }
      return bodyResult; // propagate labelled break
    }

    if (isContinueSignal(bodyResult)) {
      if (bodyResult.label && (!ctx.labels || !ctx.labels[bodyResult.label])) {
        return bodyResult;
      }

      // IMPORTANT FIX ⭐
      ctx.logger.setNext(
        node.test.loc.start.line - 1,
        "Go to WHILE condition check"
      );

      continue;
    }

    if (isReturnSignal(bodyResult) || isThrowSignal(bodyResult)) {
      result = bodyResult;
      break;
    }

    // NORMAL loop → go to next condition
    ctx.logger.setNext(
      node.test.loc.start.line - 1,
      "Go to WHILE condition check"
    );
  }

  ctx.logger.setCurrentEnv(ctx.env);
  return result;
}

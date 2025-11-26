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
} from "../next-step-helpers";

export function evalWhileStatement(node: any, ctx: EvalContext): any {
  // Each WHILE has its own block environment
  const loopEnv = ctx.env.extend("block");
  const loopCtx: EvalContext = { ...ctx, env: loopEnv };

  let result: any;
  let iteration = 0;

  while (true) {
    iteration++;
    ctx.logger.setCurrentEnv(loopEnv);

    // 🔹 1. Create a fresh timeline step for THIS iteration's condition
    ctx.logger.log(node.loc.start.line - 1);

    // 🔹 2. Safely evaluate condition for explanation (no side effects)
    const test = evaluateExpression(node.test, {
      ...loopCtx,
      safe: true,
    });

    ctx.logger.addExpressionEval(node.test, test);
    ctx.logger.addExpressionContext(node.test, "While Loop Condition");
    ctx.logger.addFlow(`WHILE CHECK (#${iteration})`);
    ctx.logger.addFlow(test ? "TRUE → body" : "FALSE → exit");

    if (!test) {
      // 🔹 Exit while: next is the outer nextStatement
      if (ctx.nextStatement) {
        ctx.logger.setNext(
          ctx.nextStatement.loc.start.line - 1,
          `Exit WHILE → ${displayHeader(
            ctx.nextStatement,
            ctx.logger.getCode()
          )}`
        );
      } else {
        ctx.logger.setNext(null, "Exit WHILE → end of block");
      }
      break;
    }

    // 🔹 3. Predict: first real statement inside body
    const firstBodyStmt =
      node.body.type === "BlockStatement"
        ? getFirstMeaningfulStatement(node.body)
        : node.body;

    if (firstBodyStmt) {
      ctx.logger.setNext(
        firstBodyStmt.loc.start.line - 1,
        `Next Step → ${displayHeader(
          firstBodyStmt,
          ctx.logger.getCode()
        )}`
      );
    }

    // 🔹 4. Execute body
    let bodyResult: any;
    if (node.body.type === "BlockStatement") {
      bodyResult = evaluateBlockBody(node.body.body, {
        ...loopCtx,
        // inside body we don't care about outer nextStatement,
        // next-step will be set by body statements themselves
        nextStatement: undefined,
      });
    } else {
      bodyResult = evaluateStatement(node.body, loopCtx);
    }

    // 🔹 5. Handle control signals coming from inside the loop body

    // break;
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
      // labeled break for some outer loop/switch → bubble up
      result = bodyResult;
      break;
    }

    // continue;
    if (isContinueSignal(bodyResult)) {
      // if it's labeled for an outer loop, propagate
      if (bodyResult.label && (!ctx.labels || !ctx.labels[bodyResult.label])) {
        result = bodyResult;
        break;
      }
      // else just start next iteration (go back to while condition)
      continue;
    }

    // return / throw
    if (isReturnSignal(bodyResult) || isThrowSignal(bodyResult)) {
      result = bodyResult;
      break;
    }

    // No signal → next iteration (condition will create a new step)
  }

  ctx.logger.setCurrentEnv(ctx.env);
  return result;
}

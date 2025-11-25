// src/engine/statements/evalFor.ts

import type { EvalContext } from "../types";
import { evaluateStatement, evaluateBlockBody } from "../evaluator";
import { evaluateExpression } from '../expressions';
import { safeEvaluate, getFirstMeaningfulStatement, displayHeader } from "../next-step-helpers";
import { isBreakSignal, isContinueSignal, isReturnSignal, isThrowSignal } from "../signals";
import { evalVariableDeclaration } from "./evalDeclarations";

export function evalForStatement(node: any, ctx: EvalContext): any {
  const loopEnv = ctx.env.extend("block");
  const loopCtx: EvalContext = { ...ctx, env: loopEnv };

  if (node.init) {
    ctx.logger.setCurrentEnv(loopEnv);
    ctx.logger.addFlow("FOR LOOP INIT:");
    if (node.init.type === "VariableDeclaration") {
      evalVariableDeclaration(node.init, loopCtx);
    } else {
      evaluateExpression(node.init, loopCtx);
    }
  }

  let iteration = 0;
  let result: any;

  while (true) {
    iteration++;
    ctx.logger.setCurrentEnv(loopEnv);

    if (node.test) {
      const test = safeEvaluate(node.test, loopCtx);
      ctx.logger.addExpressionEval(node.test, test);
      ctx.logger.addExpressionContext(node.test, "For Loop Condition");
      ctx.logger.addFlow(`FOR LOOP CHECK (iteration #${iteration})`);
      ctx.logger.addFlow(
        `Result: ${
          test ? "TRUE → enter loop body" : "FALSE → exit loop"
        }`
      );

      if (!test) {
        ctx.logger.setNext(
          node.loc.end.line,
          `Exit FOR loop → ${displayHeader(
            ctx.nextStatement,
            ctx.logger.getCode()
          )}`
        );
        break;
      }
    }

    const first =
      node.body.type === "BlockStatement"
        ? getFirstMeaningfulStatement(node.body)
        : node.body;

    if (first) {
      ctx.logger.setNext(
        first.loc.start.line - 1,
        "Next Step → " + displayHeader(first, ctx.logger.getCode())
      );
    }

    let res;
    if (node.body.type === "BlockStatement") {
      res = evaluateBlockBody(node.body.body, loopCtx);
    } else {
      res = evaluateStatement(node.body, loopCtx);
    }

    if (isBreakSignal(res)) {
      if (!res.label) {
        ctx.logger.setNext(
          node.loc.end.line,
          `Break → exit FOR loop. Next: ${displayHeader(
            ctx.nextStatement,
            ctx.logger.getCode()
          )}`
        );
        break;
      } else {
        return res;
      }
    }

    if (isContinueSignal(res)) {
      if (res.label && (!ctx.labels || !ctx.labels[res.label])) {
        return res;
      }
      // fall through → do update then next iteration
    }

    if (isReturnSignal(res) || isThrowSignal(res)) {
      result = res;
      break;
    }

    if (node.update) {
      ctx.logger.addFlow("FOR LOOP UPDATE:");
      evaluateExpression(node.update, loopCtx);
      if (node.test?.loc) {
        ctx.logger.setNext(
          node.test.loc.start.line - 1,
          "Go to loop condition check"
        );
      }
    }
  }

  ctx.logger.setCurrentEnv(ctx.env);
  return result;
}

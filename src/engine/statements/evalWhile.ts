// src/engine/statements/evalWhile.ts

import type { EvalContext } from "../types";
import { evaluateStatement, evaluateBlockBody } from "../evaluator";
import { safeEvaluate, getFirstMeaningfulStatement, displayHeader } from "../next-step-helpers";
import { isBreakSignal, isContinueSignal, isReturnSignal, isThrowSignal } from "../signals";

export function evalWhileStatement(node: any, ctx: EvalContext): any {
  const loopEnv = ctx.env.extend("block");
  const loopCtx: EvalContext = { ...ctx, env: loopEnv, currentLoop: 'while' };

  let result: any;
  let iteration = 0;

  while (true) {
    iteration++;
    ctx.logger.setCurrentEnv(loopEnv);

    logIfRealStatement(node.test, loopCtx);
    const test = safeEvaluate(node.test, loopCtx);
    ctx.logger.addExpressionEval(node.test, test);
    ctx.logger.addExpressionContext(node.test, "While Loop Condition");
    ctx.logger.addFlow("WHILE LOOP CHECK:");
    ctx.logger.addFlow(`Iteration #${iteration}`);
    ctx.logger.addFlow(
      `Result: ${
        test ? "TRUE → continue loop" : "FALSE → exit loop"
      }`
    );

    if (!test) {
      ctx.logger.setNext(
        node.loc.end.line,
        `Exit WHILE loop → ${displayHeader(
          ctx.nextStatement,
          ctx.logger.getCode()
        )}`
      );
      break;
    }

    const first = getFirstMeaningfulStatement(node.body);
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
          `Break → exit WHILE loop. Next: ${displayHeader(
            ctx.nextStatement,
            ctx.logger.getCode()
          )}`
        );
        break;
      } else {
        return res;
      }
    }

    if (isReturnSignal(res) || isThrowSignal(res)) {
      result = res;
      break;
    }

    // After body execution, explicitly point back to the condition
    if (node.test?.loc) {
        ctx.logger.setNext(
            node.test.loc.start.line - 1,
            "Next Step → evaluate while condition again"
        );
    }

    if (isContinueSignal(res)) {
      if (res.label && (!ctx.labels || !ctx.labels[res.label])) {
        return res;
      }
      continue;
    }
  }

  ctx.logger.setCurrentEnv(ctx.env);
  return result;
}

function logIfRealStatement(node: any, ctx: EvalContext) {
    // This is a minimal logger, only caring about expressions within the loop header
    if (node && node.loc && node.type.endsWith("Expression")) {
        ctx.logger.log(node.loc.start.line - 1);
    }
}

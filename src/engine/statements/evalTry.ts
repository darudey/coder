// src/engine/statements/evalTry.ts

import type { EvalContext } from "../types";
import { evaluateStatement, evaluateBlockBody } from "../evaluator";
import { isThrowSignal, isReturnSignal, isBreakSignal, isContinueSignal } from "../signals";

export function evalTryStatement(node: any, ctx: EvalContext): any {
  ctx.logger.addFlow("TRY block start");

  let res =
    node.block.type === "BlockStatement"
      ? (function () {
          const newEnv = ctx.env.extend("block");
          const innerCtx: EvalContext = { ...ctx, env: newEnv };
          ctx.logger.setCurrentEnv(newEnv);
          const r = evaluateBlockBody(node.block.body, innerCtx);
          ctx.logger.setCurrentEnv(ctx.env);
          return r;
        })()
      : evaluateStatement(node.block, ctx);

  if (isThrowSignal(res) && node.handler) {
    const catchParam = node.handler.param?.name;
    const catchBody = node.handler.body;

    ctx.logger.addFlow("Exception caught → entering catch");

    const catchEnv = ctx.env.extend("block");
    const innerCtx: EvalContext = { ...ctx, env: catchEnv };

    if (catchParam) {
      catchEnv.record.createMutableBinding(
        catchParam,
        "let",
        res.value,
        true
      );
    }

    ctx.logger.setCurrentEnv(catchEnv);
    res = evaluateBlockBody(catchBody.body, innerCtx);
    ctx.logger.setCurrentEnv(ctx.env);
  }

  if (node.finalizer) {
    ctx.logger.addFlow("Entering finally");
    const finEnv = ctx.env.extend("block");
    const finCtx: EvalContext = { ...ctx, env: finEnv };
    ctx.logger.setCurrentEnv(finEnv);
    const finRes = evaluateBlockBody(node.finalizer.body, finCtx);
    ctx.logger.setCurrentEnv(ctx.env);

    if (
      isReturnSignal(finRes) ||
      isThrowSignal(finRes) ||
      isBreakSignal(finRes) ||
      isContinueSignal(finRes)
    ) {
      return finRes;
    }
  }

  return res;
}

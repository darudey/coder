// src/engine/statements/evalBlock.ts
import type { EvalContext } from '../types';
import { evaluateBlockBody } from '../evaluator';
import { getFirstMeaningfulStatement, displayHeader } from '../next-step';

export function evalBlock(node: any, ctx: EvalContext): any {
  const shouldCreateBlock = ctx.env.kind !== "block" && ctx.env.kind !== "function";
  const newEnv = shouldCreateBlock ? ctx.env.extend("block") : ctx.env;
  const innerCtx: EvalContext = { ...ctx, env: newEnv };

  if (shouldCreateBlock) {
    ctx.logger.setCurrentEnv(newEnv);
    ctx.logger.addFlow("Entering new block scope");
    const first = getFirstMeaningfulStatement(node);
    if (first) {
        ctx.logger.setNext(first.loc.start.line - 1, `Enter block → ${displayHeader(first, ctx.logger.getCode())}`);
    }
  }

  const result = evaluateBlockBody(node.body, innerCtx);

  if (shouldCreateBlock) {
    ctx.logger.addFlow("Exiting block scope");
    if (ctx.nextStatement) {
      ctx.logger.setNext(ctx.nextStatement.loc.start.line - 1, `Exit block → ${displayHeader(ctx.nextStatement, ctx.logger.getCode())}`);
    } else {
      ctx.logger.setNext(null, "Exit block → end of block");
    }
    ctx.logger.setCurrentEnv(ctx.env);
  }

  return result;
}

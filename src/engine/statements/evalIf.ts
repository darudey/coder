
// src/engine/statements/evalIf.ts

import type { EvalContext } from "../types";
import { evaluateStatement, evaluateBlockBody, evaluateExpression } from "../evaluator";
import { getFirstMeaningfulStatement, displayHeader } from "../next-step";

export function evalIfStatement(node: any, ctx: EvalContext): any {
  const test = evaluateExpression(node.test, { ...ctx, safe: true });

  ctx.logger.addExpressionEval(node.test, test);
  ctx.logger.addExpressionContext(node.test, "If Condition");
  ctx.logger.addFlow("IF CHECK:");
  ctx.logger.addFlow(
    `Result: ${
      test ? "TRUE → taking THEN branch" : "FALSE → taking ELSE / skipping"
    }`
  );

  if (test) {
    const target = node.consequent;
    const first =
      target.type === "BlockStatement"
        ? getFirstMeaningfulStatement(target)
        : target;

    if (first) {
      ctx.logger.setNext(
        first.loc.start.line - 1,
        "Next Step → " + displayHeader(first, ctx.logger.getCode())
      );
    }

    if (target.type === "BlockStatement") {
      const newEnv = ctx.env.extend("block");
      const innerCtx: EvalContext = {
        ...ctx,
        env: newEnv,
        nextStatement: ctx.nextStatement,
      };
      ctx.logger.setCurrentEnv(newEnv);
      const res = evaluateBlockBody(target.body, innerCtx);
      ctx.logger.setCurrentEnv(ctx.env);
      return res;
    } else {
      return evaluateStatement(target, ctx);
    }
  } else if (node.alternate) {
    const target = node.alternate;
    const first =
      target.type === "BlockStatement"
        ? getFirstMeaningfulStatement(target)
        : target;

    if (first) {
      ctx.logger.setNext(
        first.loc.start.line - 1,
        "Next Step → " + displayHeader(first, ctx.logger.getCode())
      );
    }

    if (target.type === "BlockStatement") {
      const newEnv = ctx.env.extend("block");
      const innerCtx: EvalContext = {
        ...ctx,
        env: newEnv,
        nextStatement: ctx.nextStatement,
      };
      ctx.logger.setCurrentEnv(newEnv);
      const res = evaluateBlockBody(target.body, innerCtx);
      ctx.logger.setCurrentEnv(ctx.env);
      return res;
    } else {
      return evaluateStatement(target, ctx);
    }
  } else {
    if (ctx.nextStatement) {
      ctx.logger.setNext(
        ctx.nextStatement.loc.start.line - 1,
        `If false → continue to ${displayHeader(
          ctx.nextStatement,
          ctx.logger.getCode()
        )}`
      );
    }
  }
}

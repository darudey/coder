// src/engine/statements/evalExpressionStatement.ts
import type { EvalContext } from "../types";
import { evaluateExpression } from "../expressions";
import { displayHeader } from "../next-step-helpers";

export function evalExpressionStatement(node: any, ctx: EvalContext) {
  // Log expression evaluation
  const codeSlice = ctx.logger
    .getCode()
    .slice(node.expression.range[0], node.expression.range[1]);

  ctx.logger.addFlow(`Evaluating expression: ${codeSlice}`);

  const value = evaluateExpression(node.expression, ctx);

  // Add expression breakdown
  ctx.logger.addExpressionEval(node.expression, value);

  // 🔥 PATCH — show result in ExecutionFlow
  ctx.logger.addFlow(`Expression result → ${JSON.stringify(value)}`);

  // Predict next step
  if (ctx.nextStatement) {
    ctx.logger.setNext(
      ctx.nextStatement.loc.start.line - 1,
      `Next Step → ${displayHeader(
        ctx.nextStatement,
        ctx.logger.getCode()
      )}`
    );
  } else {
    ctx.logger.setNext(null, "End of block");
  }

  return value;
}

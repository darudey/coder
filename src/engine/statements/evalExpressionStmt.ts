// src/engine/statements/evalExpressionStmt.ts

import type { EvalContext } from "../types";
import { evaluateExpression } from "../expressions";

export function evalExpressionStatement(node: any, ctx: EvalContext): any {
  if (node.expression?.range && !ctx.currentLoop) {
    ctx.logger.addFlow("Evaluating expression statement");
  }
  return evaluateExpression(node.expression, ctx);
}

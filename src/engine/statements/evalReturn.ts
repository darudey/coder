// src/engine/statements/evalReturn.ts

import type { EvalContext } from "../types";
import { evaluateExpression } from "../expressions";
import { makeReturn } from "../signals";

export function evalReturnStatement(node: any, ctx: EvalContext) {
  let val: any;

  if (node.argument) {
    // Evaluate return expression
    val = evaluateExpression(node.argument, ctx);

    // Attach breakdown of the return expression to this step
    ctx.logger.addExpressionEval(node.argument, val);
    ctx.logger.addExpressionContext(node.argument, "Return value expression");
  } else {
    val = undefined;
  }

  // 🔹 Control flow narration for Execution Flow panel
  ctx.logger.addFlow(`Return encountered → value: ${JSON.stringify(val)}`);
  ctx.logger.setNext(null, "Return: control returns to caller");

  return makeReturn(val);
}

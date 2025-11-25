// src/engine/statements/evalReturn.ts

import type { EvalContext } from "../types";
import { evaluateExpression } from "../evaluator";
import { makeReturn } from "../signals";

export function evalReturnStatement(node: any, ctx: EvalContext) {
  const val = node.argument ? evaluateExpression(node.argument, ctx) : undefined;

  ctx.logger.addFlow(`Return encountered → value: ${JSON.stringify(val)}`);
  ctx.logger.setNext(null, "Return: control returns to caller");

  return makeReturn(val);
}

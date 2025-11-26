
// PATCH: ++x, x++, --x, x--

import type { EvalContext } from "../types";
import { evaluateExpression } from "../evaluator";

export function evalUpdate(node: any, ctx: EvalContext) {
  if (node.argument.type !== "Identifier") {
    throw new Error("Update target must be an identifier");
  }

  const name = node.argument.name;
  const oldValue = ctx.env.get(name);

  let newValue;
  if (node.operator === "++") newValue = oldValue + 1;
  else if (node.operator === "--") newValue = oldValue - 1;
  else throw new Error("Unsupported update operator: " + node.operator);

  ctx.env.set(name, newValue);

  return node.prefix ? newValue : oldValue;
}

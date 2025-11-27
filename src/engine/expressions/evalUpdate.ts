
// src/engine/expressions/evalUpdate.ts

import type { EvalContext } from "../types";
import { evaluateExpression } from "../expressions";

export function evalUpdateExpression(node: any, ctx: EvalContext): any {
  const logger = ctx.logger;

  // Only log a new step if this update expression is a top-level ExpressionStatement.
  if (!ctx.safe && node.loc) {
    logger.log(node.loc.start.line - 1);
  }

  // Only valid target: Identifier
  if (node.argument.type !== "Identifier") {
    throw new Error("Unsupported update target");
  }

  const name = node.argument.name;
  const oldValue = ctx.env.get(name);

  let newValue = oldValue;
  if (node.operator === "++") {
    newValue = oldValue + 1;
  } else if (node.operator === "--") {
    newValue = oldValue - 1;
  } else {
    throw new Error("Unsupported update operator: " + node.operator);
  }

  // Apply side effect
  ctx.env.set(name, newValue);

  // Friendly step log
  if (!ctx.safe) {
    const friendly = [];
    friendly.push(`Update: ${name} ${node.operator}`);
    friendly.push(`Old value: ${oldValue}`);
    friendly.push(`New value: ${newValue}`);
    friendly.push(
      `Final result (expression value): ${
        node.prefix ? newValue : oldValue
      }`
    );

    logger.addExpressionEval(node, {
      result: node.prefix ? newValue : oldValue,
      breakdown: [
        `${name} = ${oldValue}`,
        `${name} ${node.operator} → ${newValue}`,
      ],
      friendly,
    });
  }

  // Return prefix or postfix value
  return node.prefix ? newValue : oldValue;
}

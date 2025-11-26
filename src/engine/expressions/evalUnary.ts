
// PATCH: full unary operator support

import { evaluateExpression } from "../evaluator";
import type { EvalContext } from "../types";

export function evalUnary(node: any, ctx: EvalContext) {
  const arg = evaluateExpression(node.argument, ctx);

  switch (node.operator) {
    case "!":
      return !arg;

    case "+":
      return +arg;

    case "-":
      return -arg;

    case "~":
      return ~arg;

    case "typeof":
      if (node.argument.type === "Identifier") {
        try {
          return typeof ctx.env.get(node.argument.name);
        } catch {
          return "undefined"; // JS behavior
        }
      }
      return typeof arg;

    case "void":
      return void arg;

    case "delete": {
      if (node.argument.type !== "MemberExpression") {
        // delete non-member always true
        return true;
      }

      const obj = evaluateExpression(node.argument.object, ctx);
      const prop = node.argument.computed
        ? evaluateExpression(node.argument.property, ctx)
        : node.argument.property.name;

      if (obj && typeof obj === "object") {
        return delete obj[prop];
      }
      return true;
    }

    default:
      throw new Error("Unsupported unary operator: " + node.operator);
  }
}


// src/engine/expressions/evalLogical.ts
import type { EvalContext } from '../types';
import { evaluateExpression } from '../evaluator';
import { getProperty, setProperty } from "../values";
import { evalMemberTarget } from "./evalMember";

export function evalLogical(node: any, ctx: EvalContext): any {
    const left = evaluateExpression(node.left, ctx);
    if (node.operator === "&&") {
      return left && evaluateExpression(node.right, ctx);
    } else if (node.operator === "||") {
      return left || evaluateExpression(node.right, ctx);
    }
    throw new Error(`Unsupported logical operator: ${node.operator}`);
}

// --------------------------
// Logical Assignment Helpers
// --------------------------

export function makeLogicalAssignmentTarget(left: any, ctx: EvalContext) {
  // Identifier: x ??= y
  if (left.type === "Identifier") {
    const name = left.name;
    return {
      describe: name,
      get: () => ctx.env.get(name),
      set: (v: any) => ctx.env.set(name, v),
    };
  }

  // Member expression: obj.x ??= y, obj[expr] ??= y
  if (left.type === "MemberExpression") {
    const { object, property } = evalMemberTarget(left, ctx);

    let describe: string;

    if (!left.computed && left.property.type === "Identifier") {
      const objName =
        left.object.type === "Identifier" ? left.object.name : "object";
      describe = `${objName}.${left.property.name}`;
    } else {
      describe = `property ${JSON.stringify(property)} of object`;
    }

    return {
      describe,
      get: () => getProperty(object, property),
      set: (v: any) => setProperty(object, property, v),
    };
  }

  throw new Error("Unsupported logical assignment target");
}

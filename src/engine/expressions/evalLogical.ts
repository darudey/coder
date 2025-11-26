// src/engine/expressions/evalLogical.ts
import { evaluateExpression } from '../evaluator';
import type { EvalContext } from '../types';

export function evalLogical(node: any, ctx: EvalContext): any {
    const left = evaluateExpression(node.left, ctx);
    switch (node.operator) {
        case "&&":
            return left && evaluateExpression(node.right, ctx);
        case "||":
            return left || evaluateExpression(node.right, ctx);
        case "??":
            return (left === null || left === undefined)
                ? evaluateExpression(node.right, ctx)
                : left;
        default:
            throw new Error(`Unsupported logical operator: ${node.operator}`);
    }
}

// --------------------------
// Logical Assignment Helpers
// --------------------------

import { getProperty, setProperty } from "../values";
import { evalMemberTarget } from "./evalMember";

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

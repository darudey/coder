// src/engine/expressions/evalAssignment.ts
import type { EvalContext } from '../types';
import { evaluateExpression } from '../evaluator';
import { assignPattern } from '../patterns/evalDestructuring';

export function evalAssignment(node: any, ctx: EvalContext): any {
    const value = evaluateExpression(node.right, ctx);

    if (
      node.left.type === "Identifier" ||
      node.left.type === "MemberExpression" ||
      node.left.type === "ObjectPattern" ||
      node.left.type === "ArrayPattern"
    ) {
      assignPattern(node.left, value, ctx);
      return value;
    }
  
    throw new Error("Unsupported assignment target");
}

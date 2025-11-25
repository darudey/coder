// src/engine/expressions/evalLogical.ts
import type { EvalContext } from '../types';
import { evaluateExpression } from '../evaluator';

export function evalLogical(node: any, ctx: EvalContext): any {
    const left = evaluateExpression(node.left, ctx);
    if (node.operator === "&&") {
      return left && evaluateExpression(node.right, ctx);
    } else if (node.operator === "||") {
      return left || evaluateExpression(node.right, ctx);
    }
    throw new Error(`Unsupported logical operator: ${node.operator}`);
}

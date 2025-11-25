// src/engine/expressions/evalConditional.ts
import type { EvalContext } from '../types';
import { evaluateExpression } from '../evaluator';

export function evalConditional(node: any, ctx: EvalContext): any {
    const test = evaluateExpression(node.test, ctx);
    if (test) {
      return evaluateExpression(node.consequent, ctx);
    }
    return evaluateExpression(node.alternate, ctx);
}

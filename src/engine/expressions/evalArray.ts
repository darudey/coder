// src/engine/expressions/evalArray.ts
import type { EvalContext } from '../types';
import { evaluateExpression } from '../evaluator';

export function evalArray(node: any, ctx: EvalContext): any[] {
    return node.elements.map((el: any) => (el ? evaluateExpression(el, ctx) : null));
}

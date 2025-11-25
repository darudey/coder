// src/engine/statements/evalThrow.ts
import type { EvalContext } from '../types';
import { evaluateExpression } from '../evaluator';
import { makeThrow } from '../signals';

export function evalThrow(node: any, ctx: EvalContext): any {
    const arg = node.argument ? evaluateExpression(node.argument, ctx) : undefined;
    ctx.logger.addFlow(`Throw: ${JSON.stringify(arg)}`);
    return makeThrow(arg);
}

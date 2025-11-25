// src/engine/expressions/evalIdentifier.ts
import type { EvalContext } from '../types';

export function evalIdentifier(node: any, ctx: EvalContext): any {
    return ctx.env.get(node.name);
}

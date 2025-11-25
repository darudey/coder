// src/engine/statements/evalBreak.ts
import type { EvalContext } from '../types';
import { makeBreak } from '../signals';

export function evalBreak(node: any, ctx: EvalContext): any {
    const label = node.label?.name ?? null;
    ctx.logger.addFlow(`Break encountered${label ? ` → label: ${label}` : ""}`);
    return makeBreak(label);
}

// src/engine/expressions/evalUpdate.ts
import type { EvalContext } from '../types';

export function evalUpdate(node: any, ctx: EvalContext): any {
    const argNode = node.argument;
    if (argNode.type === "Identifier") {
      const name = argNode.name;
      const current = ctx.env.get(name);
      const next = node.operator === "++" ? current + 1 : current - 1;
      ctx.env.set(name, next);
      return node.prefix ? next : current;
    }
    throw new Error("Unsupported update target");
}

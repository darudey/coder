// src/engine/statements/evalFunction.ts

import type { EvalContext } from "../types";
import { createFunction } from "../values"; 

export function evalFunctionDeclaration(node: any, ctx: EvalContext) {
  const name = node.id.name;
  const fn = createFunction(node, ctx.env);
  ctx.env.record.initializeBinding(name, fn);
}

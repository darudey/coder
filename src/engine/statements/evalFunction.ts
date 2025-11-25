
// src/engine/statements/evalFunction.ts

import type { EvalContext } from "../types";
import { createUserFunction } from "../values";

export function evalFunctionDeclaration(node: any, ctx: EvalContext) {
  const name = node.id.name;
  const fn = createUserFunction(node, ctx.env);
  ctx.env.record.initializeBinding(name, fn);
}

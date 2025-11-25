
// src/engine/statements/evalClass.ts

import type { EvalContext } from "../types";
import { createClassConstructor } from "../values";

export function evalClassDeclaration(node: any, ctx: EvalContext) {
  const name = node.id.name;
  const cls = createClassConstructor(node, ctx);
  ctx.env.record.initializeBinding(name, cls);
}

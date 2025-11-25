// src/engine/statements/evalContinue.ts

import type { EvalContext } from "../types";
import { makeContinue } from "../signals";

export function evalContinueStatement(node: any, ctx: EvalContext) {
  const label = node.label?.name ?? null;
  ctx.logger.addFlow(
    `Continue encountered${label ? ` → label: ${label}` : ""}`
  );
  return makeContinue(label);
}

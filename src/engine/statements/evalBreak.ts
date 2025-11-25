
// src/engine/statements/evalBreak.ts

import type { EvalContext } from "../types";
import { makeBreak } from "../signals";

export function evalBreakStatement(node: any, ctx: EvalContext) {
  const label = node.label?.name ?? null;
  ctx.logger.addFlow(
    `Break encountered${label ? ` → label: ${label}` : ""}`
  );
  return makeBreak(label);
}

// src/engine/types.ts
import type { LexicalEnvironment } from "./environment";
import type { TimelineLogger } from "./timeline";

export interface EvalContext {
  env: LexicalEnvironment;
  thisValue: any;
  logger: TimelineLogger;
  stack: string[];
  safe?: boolean;

  // used for next-step prediction in a sequence
  nextStatement?: any;

  // for labelled break/continue targets (used by loops / labels)
  labels?: Record<string, any>;
}

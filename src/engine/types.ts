// src/engine/types.ts
import type { LexicalEnvironment } from "./environment";
import type { TimelineLogger } from "./timeline";

export interface EvalContext {
  env: LexicalEnvironment;
  thisValue: any;
  logger: TimelineLogger;
  stack: string[];
  safe?: boolean;
  nextStatement?: any;
  labels?: Record<string, any>;
}

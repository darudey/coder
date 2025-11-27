
// src/engine/statements/evalLabeled.ts
import type { EvalContext } from '../types';
import { evaluateStatement } from '../evaluator';
import { isBreakSignal } from '../signals';
import { displayHeader } from '../next-step-helpers';

export function evalLabeled(node: any, ctx: EvalContext): any {
  const labelName = node.label?.name;
  const labels = { ...(ctx.labels ?? {}) };
  if (labelName) {
    labels[labelName] = node.body;
  }
  const innerCtx: EvalContext = { ...ctx, labels };
  ctx.logger.addFlow(`Label: ${labelName}`);
  const result = evaluateStatement(node.body, innerCtx);
  
  if (isBreakSignal(result) && result.label === labelName) {
    ctx.logger.addFlow(`Break matched label ${labelName} → exit labeled block`);
    if (ctx.nextStatement) {
      ctx.logger.setNext(ctx.nextStatement.loc.start.line - 1, `After label ${labelName}: ${displayHeader(ctx.nextStatement, ctx.logger.getCode())}`);
    } else {
      ctx.logger.setNext(null, `After label ${labelName}: end`);
    }
    return; // consume break
  }
  
  return result;
}

// src/engine/statements/evalWhile.ts
import type { EvalContext } from '../types';
import { evaluateBlockBody, evaluateStatement, evaluateExpression } from '../evaluator';
import { isBreakSignal, isContinueSignal, isReturnSignal, isThrowSignal } from '../signals';
import { getFirstMeaningfulStatement, displayHeader } from '../next-step';

export function evalWhile(node: any, ctx: EvalContext): any {
  const loopCtx: EvalContext = { ...ctx }; 
  let result: any;
  let iteration = 0;

  while (true) {
    iteration++;
    ctx.logger.setCurrentEnv(loopCtx.env);
    
    const test = evaluateExpression(node.test, { ...loopCtx, safe: true });
    ctx.logger.addExpressionEval(node.test, test);
    ctx.logger.addExpressionContext(node.test, "While Loop Condition");
    ctx.logger.addFlow("WHILE LOOP CHECK:");
    ctx.logger.addFlow(`Iteration #${iteration}`);
    ctx.logger.addFlow(`Result: ${test ? "TRUE → continue loop" : "FALSE → exit loop"}`);

    if (!test) {
      ctx.logger.setNext(node.loc.end.line, `Exit WHILE loop → ${displayHeader(ctx.nextStatement, ctx.logger.getCode())}`);
      break;
    }

    const first = getFirstMeaningfulStatement(node.body);
    if (first) {
        ctx.logger.setNext(
            first.loc.start.line - 1,
            "Next Step → " + displayHeader(first, ctx.logger.getCode())
        );
    }
    
    let res;
    if (node.body.type === "BlockStatement") {
        res = evaluateBlockBody(node.body.body, loopCtx);
    } else {
        res = evaluateStatement(node.body, loopCtx);
    }

    if (isBreakSignal(res)) {
      if (!res.label) {
        ctx.logger.setNext(node.loc.end.line, `Break → exit WHILE loop. Next: ${displayHeader(ctx.nextStatement, ctx.logger.getCode())}`);
        break;
      } else {
        return res;
      }
    }
    if (isContinueSignal(res)) {
      if (res.label && (!ctx.labels || !ctx.labels[res.label])) {
        return res;
      }
      continue;
    }
    if (isReturnSignal(res) || isThrowSignal(res)) {
      result = res;
      break;
    }
  }

  ctx.logger.setCurrentEnv(ctx.env);
  return result;
}

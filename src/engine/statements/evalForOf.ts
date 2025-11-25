// src/engine/statements/evalForOf.ts
import type { EvalContext } from '../types';
import { evaluateBlockBody, evaluateStatement } from '../evaluator';
import { evaluateExpression } from '../expressions';
import { isBreakSignal, isContinueSignal, isReturnSignal, isThrowSignal } from '../signals';
import { getFirstMeaningfulStatement, displayHeader } from '../next-step';
import { evalVariableDeclaration } from './evalDeclarations';
import { assignPattern } from '../patterns/evalDestructuring';

export function evalForOf(node: any, ctx: EvalContext) {
  const loopEnv = ctx.env.extend("block");
  const loopCtx: EvalContext = { ...ctx, env: loopEnv };

  const rhs = evaluateExpression(node.right, loopCtx);
  const iterable = rhs ?? [];
  let result: any;

  ctx.logger.setCurrentEnv(loopEnv);
  ctx.logger.addFlow("FOR-OF INIT");

  const values = typeof (iterable as any)[Symbol.iterator] === "function" ? Array.from(iterable as any) : [];

  for (let idx = 0; idx < values.length; idx++) {
    const value = values[idx];

    if (node.left.type === "VariableDeclaration") {
      evalVariableDeclaration(
        { ...node.left, declarations: [{ id: node.left.declarations[0].id, init: { type: "Literal", value } }] },
        loopCtx
      );
    } else {
      assignPattern(node.left, value, loopCtx);
    }

    const first = node.body.type === "BlockStatement"
      ? getFirstMeaningfulStatement(node.body)
      : node.body;
    if (first) {
      ctx.logger.setNext(
        first.loc.start.line - 1,
        "Next Step → " + displayHeader(first, ctx.logger.getCode())
      );
    }

    const res =
      node.body.type === "BlockStatement"
        ? evaluateBlockBody(node.body.body, loopCtx)
        : evaluateStatement(node.body, loopCtx);

    if (isBreakSignal(res)) {
      if (!res.label) {
        ctx.logger.setNext(
          node.loc.end.line,
          `Break → exit FOR-OF loop. Next: ${displayHeader(ctx.nextStatement, ctx.logger.getCode())}`
        );
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

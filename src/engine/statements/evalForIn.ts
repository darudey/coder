// src/engine/statements/evalForIn.ts
import type { EvalContext } from '../types';
import { evaluateBlockBody, evaluateStatement, evaluateExpression } from '../evaluator';
import { isBreakSignal, isContinueSignal, isReturnSignal, isThrowSignal } from '../signals';
import { getFirstMeaningfulStatement, displayHeader } from '../next-step';
import { evalVariableDeclaration } from './evalDeclarations';
import { assignPattern } from '../patterns/evalDestructuring';

export function evalForIn(node: any, ctx: EvalContext) {
  const loopEnv = ctx.env.extend("block");
  const loopCtx: EvalContext = { ...ctx, env: loopEnv };

  const rhs = evaluateExpression(node.right, loopCtx) ?? {};
  const keys = Object.keys(rhs);
  let result: any;

  ctx.logger.setCurrentEnv(loopEnv);
  ctx.logger.addFlow("FOR-IN INIT");

  for (let idx = 0; idx < keys.length; idx++) {
    const key = keys[idx];

    if (node.left.type === "VariableDeclaration") {
      evalVariableDeclaration(
        { ...node.left, declarations: [{ id: node.left.declarations[0].id, init: { type: "Literal", value: key } }] },
        loopCtx
      );
    } else {
      assignPattern(node.left, key, loopCtx);
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
          `Break → exit FOR-IN loop. Next: ${displayHeader(ctx.nextStatement, ctx.logger.getCode())}`
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

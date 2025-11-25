// src/engine/statements/evalSwitch.ts

import type { EvalContext } from "../types";
import { evaluateStatement } from "../evaluator";
import { evaluateExpression } from "../expressions";
import { displayHeader } from "../next-step-helpers";
import { isBreakSignal, isReturnSignal, isContinueSignal, isThrowSignal } from "../signals";

export function evalSwitchStatement(node: any, ctx: EvalContext): any {
  const disc = evaluateExpression(node.discriminant, ctx);
  ctx.logger.addFlow(
    `SWITCH discriminant evaluated → ${JSON.stringify(disc)}`
  );

  let matchedIndex = -1;
  let defaultIndex = -1;

  for (let i = 0; i < node.cases.length; i++) {
    const c = node.cases[i];
    if (c.test === null) {
      defaultIndex = i;
    } else {
      const testVal = evaluateExpression(c.test, ctx);
      if (testVal === disc) {
        matchedIndex = i;
        break;
      }
    }
  }

  if (matchedIndex === -1) matchedIndex = defaultIndex;

  if (matchedIndex === -1) {
    ctx.logger.addFlow("SWITCH: no case matched");
    return;
  }

  for (let i = matchedIndex; i < node.cases.length; i++) {
    const c = node.cases[i];
    for (const stmt of c.consequent) {
      const res = evaluateStatement(stmt, ctx);

      if (isBreakSignal(res)) {
        if (!res.label) {
          ctx.logger.addFlow("SWITCH: break → end switch");
          if (ctx.nextStatement) {
            ctx.logger.setNext(
              ctx.nextStatement.loc.start.line - 1,
              `After switch → ${displayHeader(
                ctx.nextStatement,
                ctx.logger.getCode()
              )}`
            );
          }
          return;
        } else {
          return res;
        }
      }

      if (isReturnSignal(res) || isThrowSignal(res) || isContinueSignal(res)) {
        return res;
      }
    }
  }

  if (ctx.nextStatement) {
    ctx.logger.setNext(
      ctx.nextStatement.loc.start.line - 1,
      `After switch → ${displayHeader(
        ctx.nextStatement,
        ctx.logger.getCode()
      )}`
    );
  }
}

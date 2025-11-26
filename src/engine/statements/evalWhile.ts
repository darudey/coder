
// src/engine/statements/evalWhile.ts

import type { EvalContext } from "../types";
import { evaluateStatement, evaluateBlockBody } from "../evaluator";
import { safeEvaluate, getFirstMeaningfulStatement, displayHeader, logIfRealStatement } from "../next-step-helpers";
import { isBreakSignal, isContinueSignal, isReturnSignal, isThrowSignal } from "../signals";

export function evalWhileStatement(node: any, ctx: EvalContext): any {
    const loopEnv = ctx.env.extend("block");
    const loopCtx: EvalContext = { ...ctx, env: loopEnv };

    let iteration = 0;

    while (true) {
        iteration++;
        ctx.logger.setCurrentEnv(loopEnv);

        // Log condition as a real step
        logIfRealStatement(node.test, loopCtx);

        const cond = safeEvaluate(node.test, loopCtx);
        ctx.logger.addExpressionEval(node.test, cond);
        ctx.logger.addExpressionContext(node.test, "While Loop Condition");

        ctx.logger.addFlow(`WHILE CHECK (#${iteration})`);
        ctx.logger.addFlow(cond ? "TRUE → body" : "FALSE → exit");

        if (!cond) {
            if (ctx.nextStatement) {
                ctx.logger.setNext(
                    ctx.nextStatement.loc.start.line - 1,
                    `Exit WHILE → ${displayHeader(ctx.nextStatement, ctx.logger.getCode())}`
                );
            }
            break;
        }

        // Next-step → first statement inside body
        const first = getFirstMeaningfulStatement(node.body);
        if (first) {
            ctx.logger.setNext(
                first.loc.start.line - 1,
                `Next Step → ${displayHeader(first, ctx.logger.getCode())}`
            );
        }

        const result =
            node.body.type === "BlockStatement"
                ? evaluateBlockBody(node.body.body, loopCtx)
                : evaluateStatement(node.body, loopCtx);

        if (isBreakSignal(result)) return;
        if (isContinueSignal(result)) continue;
        if (isReturnSignal(result) || isThrowSignal(result)) return result;
    }

    ctx.logger.setCurrentEnv(ctx.env);
}


// src/engine/statements/evalWhile.ts

import type { EvalContext } from "../types";
import { evaluateStatement, evaluateBlockBody } from "../evaluator";
import { safeEvaluate, getFirstMeaningfulStatement, displayHeader, logIfRealStatement } from "../next-step-helpers";
import { isBreakSignal, isContinueSignal, isReturnSignal, isThrowSignal } from "../signals";

export function evalWhileStatement(node: any, ctx: EvalContext): any {
    const loopEnv = ctx.env.extend("block");
    // Pass the current loop type down to nested evaluations
    const loopCtx: EvalContext = { ...ctx, env: loopEnv, currentLoop: 'while' };

    let iteration = 0;

    while (true) {
        iteration++;
        ctx.logger.setCurrentEnv(loopEnv);

        // --- Step 1: Condition Check ---
        // Log the condition check as a distinct step in the timeline.
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
            } else {
                 ctx.logger.setNext(null, "End of block");
            }
            break;
        }

        // --- Step 2: Set Next-Step to Body ---
        // Predict that the next action is to enter the loop's body.
        const first = getFirstMeaningfulStatement(node.body);
        if (first) {
            ctx.logger.setNext(
                first.loc.start.line - 1,
                `Next Step → ${displayHeader(first, ctx.logger.getCode())}`
            );
        }

        // --- Step 3: Execute Body ---
        const result =
            node.body.type === "BlockStatement"
                ? evaluateBlockBody(node.body.body, loopCtx)
                : evaluateStatement(node.body, loopCtx);

        // --- Step 4: Handle Signals ---
        if (isBreakSignal(result)) {
            if (!result.label) {
                if(ctx.nextStatement) {
                    ctx.logger.setNext(ctx.nextStatement.loc.start.line -1, `Break → exit loop to ${displayHeader(ctx.nextStatement, ctx.logger.getCode())}`);
                } else {
                    ctx.logger.setNext(null, 'Break → exit loop');
                }
                break;
            }
            return result; // Labeled break
        }
        if (isContinueSignal(result)) {
            if (result.label && (!ctx.labels || !ctx.labels[result.label])) {
                return result; // Propagate labeled continue
            }
            // Simple continue: schedule next condition check
             ctx.logger.setNext(
                node.test.loc.start.line - 1,
                "Continue → check condition again"
            );
            continue;
        }
        if (isReturnSignal(result) || isThrowSignal(result)) {
            // Propagate return/throw signals up immediately.
            return result;
        }

        // --- Step 5: Schedule Next Condition Check ---
        // After a successful body execution, the next logical step is to re-evaluate the condition.
        ctx.logger.setNext(
            node.test.loc.start.line - 1,
            "Next Step → evaluate while condition again"
        );
    }

    ctx.logger.setCurrentEnv(ctx.env);
}


// src/engine/statements/evalForIn.ts
import type { EvalContext } from '../types';
import { evaluateBlockBody, evaluateStatement, evaluateExpression } from '../evaluator';
import { isBreakSignal, isContinueSignal, isReturnSignal } from '../signals';
import { getFirstMeaningfulStatement, displayHeader } from '../next-step-helpers';

export function evalForIn(node: any, ctx: EvalContext) {
    const obj = evaluateExpression(node.right, ctx);
    if (obj === null || obj === undefined) {
        // If object is null or undefined, the loop is skipped.
        if (ctx.nextStatement) {
            ctx.logger.setNext(
                ctx.nextStatement.loc.start.line - 1,
                `After FOR-IN → ${displayHeader(ctx.nextStatement, ctx.logger.getCode())}`
            );
        }
        return;
    }

    const keys = Object.keys(obj);
    let iteration = 0;

    for (const key of keys) {
        iteration++;

        if (node.left.type === "VariableDeclaration") {
            const decl = node.left.declarations[0];
            ctx.env.record.createMutableBinding(
                decl.id.name,
                "let",
                key,
                true
            );
        } else {
            ctx.env.set(node.left.name, key);
        }

        ctx.logger.addFlow(`FOR-IN (#${iteration}) → key = ${key}`);

        const first = node.body.type === "BlockStatement"
            ? getFirstMeaningfulStatement(node.body)
            : node.body;

        if (first) {
            ctx.logger.setNext(
                first.loc.start.line - 1,
                `Next Step → ${displayHeader(first, ctx.logger.getCode())}`
            );
        }

        const res = node.body.type === "BlockStatement"
            ? evaluateBlockBody(node.body.body, ctx)
            : evaluateStatement(node.body, ctx);

        if (isBreakSignal(res)) return;
        if (isContinueSignal(res)) continue;
        if (isReturnSignal(res)) return res;
    }

    if (ctx.nextStatement) {
        ctx.logger.setNext(
            ctx.nextStatement.loc.start.line - 1,
            `After FOR-IN → ${displayHeader(ctx.nextStatement, ctx.logger.getCode())}`
        );
    }
}


// src/engine/statements/evalForOf.ts
import type { EvalContext } from '../types';
import { evaluateBlockBody, evaluateStatement, evaluateExpression } from '../evaluator';
import { isBreakSignal, isContinueSignal, isReturnSignal } from '../signals';
import { getFirstMeaningfulStatement, displayHeader } from '../next-step-helpers';

export function evalForOf(node: any, ctx: EvalContext) {
    const rightVal = evaluateExpression(node.right, ctx);
    if (!rightVal || typeof rightVal[Symbol.iterator] !== 'function') {
        throw new TypeError("Right-hand side of 'for...of' is not iterable.");
    }
    const iterator = rightVal[Symbol.iterator]();

    ctx.logger.addFlow("FOR-OF: start iteration");

    let step;
    let iteration = 0;

    while (!(step = iterator.next()).done) {
        iteration++;

        const value = step.value;

        // Bind loop variable
        if (node.left.type === "VariableDeclaration") {
            const decl = node.left.declarations[0];
            ctx.env.record.createMutableBinding(
                decl.id.name,
                "let",
                value,
                true
            );
        } else if (node.left.type === "Identifier") {
            ctx.env.set(node.left.name, value);
        }

        ctx.logger.addFlow(`FOR-OF (#${iteration}) → value = ${JSON.stringify(value)}`);

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
            `After FOR-OF → ${displayHeader(ctx.nextStatement, ctx.logger.getCode())}`
        );
    }
}

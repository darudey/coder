
// src/engine/statements/evalExpressionStmt.ts
import type { EvalContext } from "../types";
import { evaluateExpression } from "../expressions";
import { displayHeader } from "../next-step-helpers";

export function evalExpressionStatement(
  node: any,
  ctx: EvalContext
): any {
  const logger = ctx.logger;

  // Take a snapshot of the step representing THIS statement
  const statementStep = logger.peekLastStep?.();

  const codeSlice = logger
    .getCode()
    .slice(node.expression.range[0], node.expression.range[1]);

  // Flow text before evaluation
  logger.addFlow(`Evaluating expression: ${codeSlice}`);

  // Evaluate the expression
  const value = evaluateExpression(node.expression, ctx);

  // Add expression breakdown & friendly text
  logger.addExpressionEval(node.expression, value);
  logger.addFlow(`Expression result → ${JSON.stringify(value)}`);

  // Fix the "..." next-step on THIS statement only
  if (statementStep && statementStep.nextStep?.message === "...") {
    if (ctx.nextStatement) {
      logger.setNext(
        ctx.nextStatement.loc.start.line - 1,
        `Next Step → ${displayHeader(
          ctx.nextStatement,
          logger.getCode()
        )}`,
        statementStep // <-- patch THIS step, not the last one
      );
    } else {
      logger.setNext(
        null,
        "End of block",
        statementStep
      );
    }
  }

  return value;
}

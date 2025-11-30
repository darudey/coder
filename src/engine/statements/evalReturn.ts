// src/engine/statements/evalReturn.ts
import type { EvalContext } from "../types";
import { evaluateExpression } from "../expressions";
import { makeReturn } from "../signals";

/**
 * Small helper to keep Control Flow logs readable.
 * We don't want to dump the entire internal FunctionValue structure.
 */
function formatValueForLog(value: any): string {
  if (value && typeof value === "object" && (value as any).__isFunctionValue) {
    return "[Function]";
  }
  if (typeof value === "function") return "[NativeFunction]";

  try {
    return JSON.stringify(value);
  } catch {
    try {
      return String(value);
    } catch {
      return "[Unprintable]";
    }
  }
}

export function evalReturnStatement(node: any, ctx: EvalContext): any {
  const logger = ctx.logger;
  const arg = node.argument;

  logger.addFlow("Evaluating return expression");

  let value: any = undefined;

  if (arg) {
    value = evaluateExpression(arg, ctx);

    // mark this expression as "return value" for the Expression Evaluation panel
    logger.addExpressionContext(arg, "Return value expression");
    logger.addExpressionEval(arg, value);
  }

  const pretty = formatValueForLog(value);

  // Clean, short messages instead of giant JSON blobs
  logger.addFlow(`Return encountered → value: ${pretty}`);

  const funcName = ctx.stack[ctx.stack.length - 1] || "<anonymous>";
  logger.addFlow(`Return → ${funcName} returns ${pretty}`);

  // After return, control goes back to caller
  logger.setNext(null, "Return: control returns to caller");

  return makeReturn(value);
}

// src/engine/statements/evalReturn.ts
import type { EvalContext } from "../types";
import { evaluateExpression } from "../expressions";
import { makeReturn } from "../signals";

function formatValueForLog(value: any): string {
  if (value === null || value === undefined) return String(value);
  const t = typeof value;
  if (t === "string") return JSON.stringify(value);
  if (t === "number" || t === "boolean") return String(value);
  if (value && t === "object" && (value as any).__isFunctionValue) return "[Function]";
  if (t === "function") return "[NativeFunction]";
  if (Array.isArray(value)) return `[Array(${value.length})]`;
  return "[Object]";
}

export function evalReturnStatement(node: any, ctx: EvalContext): any {
  const logger = ctx.logger;
  const arg = node.argument;

  logger.addFlow("Evaluating return expression");

  let value: any = undefined;

  if (arg) {
    value = evaluateExpression(arg, ctx);
    logger.addExpressionContext(arg, "Return value expression");
    logger.addExpressionEval(arg, value);
  }

  const pretty = formatValueForLog(value);

  logger.addFlow(`Return encountered → value: ${pretty}`);

  const funcName = ctx.stack[ctx.stack.length - 1] || "<anonymous>";
  logger.addFlow(`Return → ${funcName} returns ${pretty}`);

  logger.setNext(null, "Return: control returns to caller");

  return makeReturn(value);
}

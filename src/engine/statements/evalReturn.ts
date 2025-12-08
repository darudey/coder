// src/engine/statements/evalReturn.ts
import type { EvalContext } from "../types";
import { evaluateExpression } from "../expressions";
import { makeReturn } from "../signals";

/**
 * Very conservative formatter for values in Control Flow logs.
 * NEVER dumps large objects or internal FunctionValue structure.
 */
function formatValueForLog(value: any): string {
  // null / undefined
  if (value === null || value === undefined) {
    return String(value); // "null" / "undefined"
  }

  const t = typeof value;

  // primitives
  if (t === "string") {
    // quote strings so it's clear it's a string
    return JSON.stringify(value);
  }
  if (t === "number" || t === "boolean") {
    return String(value);
  }

  // internal user-defined function value
  if (value && t === "object" && (value as any).__isFunctionValue) {
    // show minimal info only
    const nodeType = (value as any).__node?.type ?? "Function";
    const maybeName = (value as any).__node?.id?.name ?? "";
    return `[Function${maybeName ? " " + maybeName : ""} — ${nodeType}]`;
  }

  // plain function
  if (t === "function") {
    return "[NativeFunction]";
  }

  // arrays – short summary only
  if (Array.isArray(value)) {
    return `[Array(${value.length})]`;
  }

  // any other object – we DO NOT JSON.stringify it
  // to avoid huge blobs and circular structures
  return "[Object]";
}

export function evalReturnStatement(node: any, ctx: EvalContext): any {
  const logger = ctx.logger;
  const arg = node.argument;

  let value: any = undefined;

  if (arg) {
    value = evaluateExpression(arg, ctx);

    // mark this expression as "return value" for the Expression Evaluation panel
    logger.addExpressionEval(arg, value, undefined, ctx.env); // Pass environment
    logger.addExpressionContext(arg, "Return value expression");
  }

  const pretty = formatValueForLog(value);
  logger.addFlow(`Return value → ${pretty}`);

  // After return, control goes back to caller
  logger.setNext(null, "Return: control returns to caller");

  return makeReturn(value);
}

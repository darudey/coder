
// src/engine/expressions/evalCall.ts
import type { EvalContext } from "../types";
import { evaluateExpression } from "../evaluator";
import { isUserFunction, FunctionValue } from "../values";
import { isReturnSignal } from "../signals";
import { evalMemberTarget } from "./evalMember";
import { getFirstMeaningfulStatement, displayHeader } from "../next-step-helpers";

function safeString(v: any): string {
  try {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (typeof v === "string") return JSON.stringify(v);
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "function") return "[Function]";
    if (v && typeof v === "object" && v.__isFunctionValue) return "[Function]";
    try { return JSON.stringify(v); } catch {
      if (Array.isArray(v)) return `[Array(${v.length})]`;
      if (v && typeof v === "object") return `[Object:${v.constructor?.name || "Object"}]`;
      return String(v);
    }
  } catch {
    return "[Unprintable]";
  }
}

function getCalleeName(node: any, value: any): string {
  if (!node) return "<call>";
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression") {
    if (node.computed) {
      try { return node.property?.name ?? node.property?.value ?? "<member>"; } catch { return "<member>"; }
    }
    return node.property?.name ?? "<member>";
  }
  if (value?.__node?.type === "ArrowFunctionExpression") return "(arrow closure)";
  return "<function>";
}

function readBindingsFromRecord(recordLike: any): Record<string, any> {
  const out: Record<string, any> = {};
  try {
    if (!recordLike) return out;
    if (typeof recordLike.keys === "function" && typeof recordLike.get === "function") {
      for (const k of recordLike.keys()) {
        try {
          const entry = recordLike.get(k);
          out[k] = entry && typeof entry === "object" && "value" in entry ? entry.value : entry;
        } catch { out[k] = "[Unreadable]"; }
      }
    } else {
      for (const k of Object.keys(recordLike)) {
        try {
          const v = (recordLike as any)[k];
          out[k] = v && typeof v === "object" && "value" in v ? v.value : v;
        } catch { out[k] = "[Unreadable]"; }
      }
    }
  } catch {}
  return out;
}

export function evalCall(node: any, ctx: EvalContext): any {
  const calleeVal = evaluateExpression(node.callee, ctx);
  const args = node.arguments.map((arg: any) => evaluateExpression(arg, ctx));

  let thisArg: any;
  if (node.callee.type === "MemberExpression") {
    const { object } = evalMemberTarget(node.callee, ctx);
    thisArg = object;
  } else {
    thisArg = ctx.thisValue ?? undefined;
  }

  const calleeName = getCalleeName(node.callee, calleeVal);
  ctx.logger.addFlow(`Calling function ${calleeName}(${args.map(a => safeString(a)).join(", ")})`);

  // ---- ENTRY LOG FOR ARROW CLOSURES ----
  if (calleeVal && calleeVal.__node?.type === "ArrowFunctionExpression") {
    const params = (calleeVal.__params ?? []).map((p: any) => p.name ?? "<param>");
    const paramPairs = params.map((p: any, i: number) => `${p} = ${safeString(args[i])}`);

    const capturedPairs: string[] = [];
    try {
      let env = calleeVal.__env;
      while (env && env.outer) {
        const recBindings = env.outer.record?.bindings ?? env.outer.record ?? null;
        const normalized = readBindingsFromRecord(recBindings);
        for (const [key, val] of Object.entries(normalized)) {
          if (!params.includes(key) && capturedPairs.find(p => p.startsWith(key + ' =')) === undefined) {
            capturedPairs.push(`${key} = ${safeString(val)}`);
          }
        }
        env = env.outer;
      }
    } catch {}

    // create step at arrow body line (so UI focuses body)
    if (calleeVal.__node.body?.loc) {
      const body = calleeVal.__node.body;
      const line = body.type === "BlockStatement" ? (getFirstMeaningfulStatement(body)?.loc?.start.line - 1 ?? null) : (body.loc.start.line - 1);
      ctx.logger.log(body.loc.start.line - 1);
      ctx.logger.setNext(line, "", ctx.logger.peekLastStep());
    }

    ctx.logger.addFlow(`Entering closure (${paramPairs.join(", ")})`);
    if (capturedPairs.length > 0) ctx.logger.addFlow(`Captured: ${capturedPairs.join(", ")}`);
  }

  // ---- Predict next-step for non-arrow functions (block bodies) ----
  if (calleeVal && calleeVal.__node && calleeVal.__node.type !== "ArrowFunctionExpression") {
    const body = calleeVal.__node.body;
    if (body?.loc) {
      const line = body.type === "BlockStatement"
        ? (getFirstMeaningfulStatement(body)?.loc?.start.line - 1 ?? null)
        : (body.loc.start.line - 1);
      const msg = body.type === "BlockStatement"
        ? `Next Step → ${displayHeader(body, ctx.logger.getCode())}`
        : `Evaluate arrow body: ${displayHeader(body, ctx.logger.getCode())}`;
      ctx.logger.setNext(line, msg);
    }
  }

  // builtin console.log
  if (calleeVal && (calleeVal as any).__builtin === "console.log") {
    const formattedArgs = args.map(a => safeString(a)).join(" ");
    ctx.logger.logOutput(formattedArgs);
    ctx.logger.addFlow(`console.log → ${formattedArgs}`);
    return undefined;
  }

  if (typeof calleeVal === "function" && !isUserFunction(calleeVal)) {
    return calleeVal.apply(thisArg, args);
  }

  if (isUserFunction(calleeVal)) {
    const fn = calleeVal as FunctionValue;
    if (!fn.__ctx) fn.__ctx = { logger: ctx.logger, stack: ctx.stack };

    const result = fn.call(thisArg, args);
    if (isReturnSignal(result)) return result.value;
    return result;
  }

  throw new Error("Call of non-function value");
}

// src/engine/expressions/evalCall.ts
import type { EvalContext } from "../types";
import { evaluateExpression } from "../evaluator";
import { isUserFunction, FunctionValue } from "../values";
import { isReturnSignal } from "../signals";
import { evalMemberTarget } from "./evalMember";
import { getFirstMeaningfulStatement, displayHeader } from "../next-step-helpers";


// ---------- Safe string for Flow messages ----------
function safeString(v: any): string {
  try {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (typeof v === "string") return JSON.stringify(v);
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "function") return "[Function]";
    if (v?.__isFunctionValue) return "[Function]";

    try {
      return JSON.stringify(v);
    } catch {
      if (Array.isArray(v)) return `[Array(${v.length})]`;
      if (typeof v === "object") return `[Object:${v.constructor?.name || "Object"}]`;
      return String(v);
    }
  } catch {
    return "[Unprintable]";
  }
}


// ---------- Call name resolver ----------
function getCalleeName(node: any, value: any): string {
  if (!node) return "<call>";
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression") {
    if (!node.computed) return node.property?.name ?? "<member>";
    const p = node.property?.name ?? node.property?.value;
    return p ? String(p) : "<member>";
  }
  if (value?.__node?.type === "ArrowFunctionExpression") return "(arrow closure)";
  return "<function>";
}


// ---------- Normalize environment bindings ----------
function readBindingsFromRecord(recordLike: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (!recordLike) return out;

  try {
    if (typeof recordLike.keys === "function") {
      // Map-like API
      for (const key of recordLike.keys()) {
        const entry = recordLike.get(key);
        out[key] = entry?.value ?? entry;
      }
    } else {
      // Plain object
      for (const key of Object.keys(recordLike)) {
        const val = recordLike[key];
        out[key] = val?.value ?? val;
      }
    }
  } catch {
    // avoid crashing debugger
  }
  return out;
}



// ---------- MAIN: evalCall ----------
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

  ctx.logger.addFlow(
    `Calling function ${calleeName}(${args.map(a => safeString(a)).join(", ")})`
  );


  // ---------- Special handling for Arrow Closures ----------
  if (calleeVal?.__node?.type === "ArrowFunctionExpression") {
    const params = (calleeVal.__params ?? []).map((p: any) => p.name ?? "<param>");

    const paramPairs = params.map((p, i) => `${p} = ${safeString(args[i])}`);

    // Capture lexical environment
    const capturedPairs: string[] = [];
    try {
      let env = calleeVal.__env;

      while (env && env.outer) {
        const recBindings = env.outer.record?.bindings ?? env.outer.record;
        const normalized = readBindingsFromRecord(recBindings);

        for (const [key, val] of Object.entries(normalized)) {
          if (!params.includes(key) &&
              !capturedPairs.some(x => x.startsWith(key + " ="))) {
            capturedPairs.push(`${key} = ${safeString(val)}`);
          }
        }
        env = env.outer;
      }
    } catch {}

    ctx.logger.addFlow(`Entering closure (${paramPairs.join(", ")})`);
    if (capturedPairs.length) {
      ctx.logger.addFlow(`Captured: ${capturedPairs.join(", ")}`);
    }

    // Predict evaluation of arrow body (only if not predicted already)
    const body = calleeVal.__node.body;
    if (body?.loc && !ctx.logger.peekLastStep()?.nextStep) {
      ctx.logger.setNext(
        body.loc.start.line - 1,
        `Evaluate arrow body: ${displayHeader(body, ctx.logger.getCode())}`
      );
    }
  }


  // ---------- Predict next-step for normal functions ----------
  if (calleeVal?.__node && calleeVal.__node.type !== "ArrowFunctionExpression") {
    const body = calleeVal.__node.body;
    if (body?.loc) {
      const line = body.type === "BlockStatement"
        ? getFirstMeaningfulStatement(body)?.loc?.start.line - 1
        : body.loc.start.line - 1;

      ctx.logger.setNext(
        line,
        `Next Step → ${displayHeader(body, ctx.logger.getCode())}`
      );
    }
  }


  // ---------- builtin console.log ----------
  if (calleeVal?.__builtin === "console.log") {
    const formatted = args.map(a => safeString(a)).join(" ");
    ctx.logger.logOutput(formatted);
    ctx.logger.addFlow(`console.log → ${formatted}`);
    return undefined;
  }


  // ---------- Host functions ----------
  if (typeof calleeVal === "function" && !isUserFunction(calleeVal)) {
    return calleeVal.apply(thisArg, args);
  }


  // ---------- User-defined functions ----------
  if (isUserFunction(calleeVal)) {
    const fn = calleeVal as FunctionValue;
    if (!fn.__ctx) fn.__ctx = { logger: ctx.logger, stack: ctx.stack };

    const result = fn.call(thisArg, args);
    if (isReturnSignal(result)) return result.value;
    return result;
  }


  throw new Error("Call of non-function value");
}

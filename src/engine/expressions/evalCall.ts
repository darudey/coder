
// src/engine/expressions/evalCall.ts
//
// FINAL PHASE-2 VERSION
// • Clean call separators (── Call #N start/complete ──)
// • Correct arrow closure logging
// • Closure explanation only ONCE
// • Teaching-friendly narration
// • No duplicate steps
// • No prediction drift
//

import type { EvalContext } from "../types";
import { evaluateExpression } from "../evaluator";
import { isUserFunction, FunctionValue } from "../values";
import { isReturnSignal } from "../signals";
import { evalMemberTarget } from "./evalMember";
import { getFirstMeaningfulStatement, displayHeader } from "../next-step-helpers";

let CALL_COUNTER = 0;
export function resetCallCounter() { CALL_COUNTER = 0; }

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

function safeString(v: any): string {
  try {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (typeof v === "string") return JSON.stringify(v);
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "function") return "[Function]";
    if (v && typeof v === "object" && v.__isFunctionValue) return "[Function]";
    return JSON.stringify(v);
  } catch {
    return "[Object]";
  }
}

function getCalleeName(node: any, value: any): string {
  if (!node) return "<call>";
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression") {
    return node.computed ? "<computed>" : node.property?.name ?? "<member>";
  }
  if (value?.__node?.type === "ArrowFunctionExpression") return "(arrow closure)";
  return "<function>";
}

/**
 * Collect ONLY lexical outer function bindings.
 * Stops at Script/Global to avoid large captures.
 */
function collectCapturedVariables(fn: FunctionValue): string[] {
  const result: string[] = [];
  let env = fn.__env;

  while (env && env.outer && env.outer.kind === "function") {
    const rec = env.outer.record?.bindings;
    if (rec) {
      const names = typeof rec.keys === "function" ? [...rec.keys()] : Object.keys(rec);
      for (const name of names) {
        const binding = typeof rec.get === "function" ? rec.get(name) : rec[name];
        const val = binding?.value ?? binding;
        result.push(`${name} = ${safeString(val)}`);
      }
    }
    env = env.outer;
  }
  return result;
}

// ----------------------------------------------------------------------
// evalCall — HEART OF CALL EXECUTION
// ----------------------------------------------------------------------

export function evalCall(node: any, ctx: EvalContext): any {
  CALL_COUNTER++;
  ctx.logger.addFlow(`── Call #${CALL_COUNTER} start ──`);

  const calleeVal = evaluateExpression(node.callee, ctx);
  const args = node.arguments.map((arg: any) => evaluateExpression(arg, ctx));

  const thisArg =
    node.callee.type === "MemberExpression"
      ? evalMemberTarget(node.callee, ctx).object
      : ctx.thisValue ?? undefined;

  const calleeName = getCalleeName(node.callee, calleeVal);

  ctx.logger.addFlow(
    `Calling function ${calleeName}(${args.map(a => safeString(a)).join(", ")})`
  );

  // ------------------------------------------------------------------
  // ✔ Arrow closure entry (teaching-friendly)
  // ------------------------------------------------------------------
  if (calleeVal?.__node?.type === "ArrowFunctionExpression") {
    const params = calleeVal.__params.map((p: any, i: number) =>
      `${p.name} = ${safeString(args[i])}`
    );

    ctx.logger.addFlow(`Entering closure (${params.join(", ")})`);

    // Explain closure only ONCE
    if (!calleeVal.__closureExplained) {
      const captured = collectCapturedVariables(calleeVal);
      if (captured.length > 0) {
        ctx.logger.addFlow(
          `Closure created. It remembers: ${captured.join(", ")}`
        );
      }
      calleeVal.__closureExplained = true;
    }

    // DO NOT create a new timeline step — expressions.ts handles this
    const body = calleeVal.__node.body;
    if (body?.loc) {
      ctx.logger.setNext(body.loc.start.line - 1, `Evaluate arrow body`);
    }
  }

  // ------------------------------------------------------------------
  // ✔ Next-step prediction for normal functions
  // ------------------------------------------------------------------
  if (calleeVal?.__node && calleeVal.__node.type !== "ArrowFunctionExpression") {
    const body = calleeVal.__node.body;
    if (body?.loc) {
      const first =
        body.type === "BlockStatement"
          ? getFirstMeaningfulStatement(body)?.loc?.start.line - 1
          : body.loc.start.line - 1;

      ctx.logger.setNext(
        first,
        `Next Step → ${displayHeader(body, ctx.logger.getCode())}`
      );
    }
  }

  // ------------------------------------------------------------------
  // ✔ Builtin console.log
  // ------------------------------------------------------------------
  if (calleeVal && (calleeVal as any).__builtin === "console.log") {
    const formattedArgs = args.map(a => safeString(a)).join(" ");
    ctx.logger.logOutput(formattedArgs);
    ctx.logger.addFlow(`console.log → ${formattedArgs}`);
    ctx.logger.addFlow(`── Call #${CALL_COUNTER} complete (returned undefined) ──`);
    return undefined;
  }

  // ------------------------------------------------------------------
  // ✔ Native JS function
  // ------------------------------------------------------------------
  if (typeof calleeVal === "function" && !isUserFunction(calleeVal)) {
    const result = calleeVal.apply(thisArg, args);
    ctx.logger.addFlow(
      `── Call #${CALL_COUNTER} complete (returned ${safeString(result)}) ──`
    );
    return result;
  }

  // ------------------------------------------------------------------
  // ✔ User-defined function (function or arrow)
  // ------------------------------------------------------------------
  if (isUserFunction(calleeVal)) {
    const fn = calleeVal as FunctionValue;

    // Provide logger/stack to user function
    if (!fn.__ctx) fn.__ctx = { logger: ctx.logger, stack: ctx.stack };

    const result = fn.call(thisArg, args);

    if (isReturnSignal(result)) {
      ctx.logger.addFlow(
        `── Call #${CALL_COUNTER} complete (returned ${safeString(
          result.value
        )}) ──`
      );
      return result.value;
    }

    ctx.logger.addFlow(
      `── Call #${CALL_COUNTER} complete (returned ${safeString(result)}) ──`
    );
    return result;
  }

  throw new Error("Call of non-function value");
}

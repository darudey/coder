
// src/engine/expressions/evalCall.ts
import type { EvalContext } from "../types";
import { evaluateExpression } from "../evaluator";
import { isUserFunction, FunctionValue } from "../values";
import { isReturnSignal } from "../signals";
import { evalMemberTarget } from "./evalMember";
import { getFirstMeaningfulStatement, displayHeader } from "../next-step-helpers";

function getCalleeName(node: any, value: any): string {
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression") return node.property.name;
  if (value?.__node?.type === "ArrowFunctionExpression") return "(arrow closure)";
  return "<function>";
}

function readBindingsFromRecord(recordLike: any): Record<string, any> {
  // Support both Map and plain object bindings shapes
  const out: Record<string, any> = {};
  try {
    if (!recordLike) return out;
    if (typeof recordLike.keys === "function" && typeof recordLike.get === "function") {
      // Map-like API
      for (const k of recordLike.keys()) {
        try {
          const entry = recordLike.get(k);
          // environment record binding shape could be { value: ... } or direct value
          out[k] = entry && typeof entry === "object" && "value" in entry ? entry.value : entry;
        } catch {
          out[k] = "[Unreadable]";
        }
      }
    } else {
      // plain object
      for (const k of Object.keys(recordLike)) {
        try {
          const v = (recordLike as any)[k];
          out[k] = v && typeof v === "object" && "value" in v ? v.value : v;
        } catch {
          out[k] = "[Unreadable]";
        }
      }
    }
  } catch {
    // ignore
  }
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

  ctx.logger.addFlow(
    `Calling function ${calleeName}(${args.map((a) => JSON.stringify(a)).join(", ")})`
  );

  // ---- ENTRY LOG FOR ARROW CLOSURES ----
  if (calleeVal?.__node?.type === "ArrowFunctionExpression") {
    const params = calleeVal.__params.map((p: any) => p.name);
    const paramPairs = params.map((p: any, i: number) =>
        `${p} = ${JSON.stringify(args[i])}`
    );

    // --- Capture outer variables ---
    let capturedPairs: string[] = [];
    try {
        let env = calleeVal.__env;
        while (env && env.outer) {
            const rec = env.outer.record?.bindings;
            if (rec) {
                if (typeof rec.keys === "function") { // Map-like
                    for (const key of rec.keys()) {
                        if (!params.includes(key))
                            capturedPairs.push(`${key} = ${JSON.stringify(rec.get(key)?.value)}`);
                    }
                } else { // Object-like
                    for (const key of Object.keys(rec)) {
                        if (!params.includes(key))
                            capturedPairs.push(`${key} = ${JSON.stringify(rec[key])}`);
                    }
                }
            }
            env = env.outer;
        }
    } catch {}

    // Attach flow messages to the *next* step that will be created
    ctx.logger.addFlow(`Entering closure (${paramPairs.join(", ")})`);
    if (capturedPairs.length > 0)
        ctx.logger.addFlow(`Captured: ${capturedPairs.join(", ")}`);
  }


  // For non-arrow functions, predict next meaningful statement inside function if possible
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

  // builtin console.log shortcut
  if (calleeVal && (calleeVal as any).__builtin === "console.log") {
    const formattedArgs = args.join(" ");
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

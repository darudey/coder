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

  // If callee is a user arrow closure -> create a dedicated "enter closure" step at the arrow body line
  if (calleeVal?.__node?.type === "ArrowFunctionExpression") {
    const arrowNode = calleeVal.__node;
    const body = arrowNode.body;
    const bodyLine = body?.loc?.start?.line ? body.loc.start.line - 1 : null;

    // Create a step at the arrow body line (so UI shows entry at the closure's location)
    if (bodyLine !== null) {
      ctx.logger.log(bodyLine);
    }

    // Build parameter pairs
    const params = (calleeVal.__params ?? []).map((p: any) => p.name);
    const paramPairs = params.map((p: string, i: number) => `${p} = ${JSON.stringify(args[i])}`);

    // Collect captured variables from the closure's defining env chain (outer frames)
    const captured: Record<string, any> = {};
    try {
      let env = calleeVal.__env;
      // Move one step outward: the closure's own env typically has its params; we want defining outer scopes
      if (env && env.outer) env = env.outer;
      while (env) {
        // env.record.bindings or env.bindings or env.record?.bindings
        const recordLike = (env.record && (env.record as any).bindings) ?? (env as any).bindings ?? null;
        const frameBindings = readBindingsFromRecord(recordLike);
        for (const k of Object.keys(frameBindings)) {
          if (params.indexOf(k) !== -1) continue; // skip params
          if (!(k in captured)) {
            captured[k] = frameBindings[k];
          }
        }
        env = env.outer;
      }
    } catch (e) {
      // swallow — capturing best-effort
    }

    // Narrate entering closure + params + captured
    if (paramPairs.length > 0) {
      ctx.logger.addFlow(`Entering closure (${paramPairs.join(", ")})`);
    } else {
      ctx.logger.addFlow(`Entering closure`);
    }

    const capturedPairs = Object.entries(captured)
      .map(([k, v]) => `${k} = ${JSON.stringify(v)}`);
    if (capturedPairs.length > 0) {
      ctx.logger.addFlow(`Captured: ${capturedPairs.join(", ")}`);
    }

    // Predict next step: evaluate arrow body (line of body)
    if (bodyLine !== null) {
      ctx.logger.setNext(
        bodyLine,
        `Evaluate arrow body: ${displayHeader(body, ctx.logger.getCode())}`
      );
    }
  } else {
    // For non-arrow functions, predict next meaningful statement inside function if possible
    if (calleeVal?.__node) {
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

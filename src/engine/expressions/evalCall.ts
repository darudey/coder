
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

  if (value?.__node?.type === "ArrowFunctionExpression") {
    return "(arrow function)";
  }

  return "<function>";
}

export function evalCall(node: any, ctx: EvalContext): any {
  const calleeVal = evaluateExpression(node.callee, ctx);
  const args = node.arguments.map((arg: any) =>
    evaluateExpression(arg, ctx)
  );

  let thisArg: any;
  if (node.callee.type === "MemberExpression") {
    const { object } = evalMemberTarget(node.callee, ctx);
    thisArg = object;
  } else {
    thisArg = ctx.thisValue ?? undefined;
  }

  const calleeName = getCalleeName(node.callee, calleeVal);

  // High-level call narration on the caller step
  ctx.logger.addFlow(
    `Calling function ${calleeName}(${args
      .map((a) => JSON.stringify(a))
      .join(", ")})`
  );

    // PREDICT NEXT-STEP for ALL function types
    if (calleeVal?.__node) {
        const body = calleeVal.__node.body;

        if (body?.loc) {
            let line: number | null = null;
            let message: string = "";

            if (body.type === "BlockStatement") {
                const firstStmt = getFirstMeaningfulStatement(body);
                line = firstStmt ? firstStmt.loc.start.line -1 : null;
                message = `Next Step → ${displayHeader(calleeVal.__node, ctx.logger.getCode())}`;
            } else {
                line = body.loc.start.line - 1;
                message = `Evaluate arrow body: ${displayHeader(body, ctx.logger.getCode())}`;
            }

            ctx.logger.setNext(line, message);
        }
    }

  // Built-in console.log handling
  if (calleeVal && (calleeVal as any).__builtin === "console.log") {
    const formattedArgs = args.join(" ");
    ctx.logger.logOutput(formattedArgs);
    ctx.logger.addFlow(`console.log → ${formattedArgs}`);
    return undefined;
  }

  // Native JS function (e.g. Math.max)
  if (typeof calleeVal === "function" && !isUserFunction(calleeVal)) {
    return calleeVal.apply(thisArg, args);
  }

  // Our engine's user function
  if (isUserFunction(calleeVal)) {
    const fn = calleeVal as FunctionValue;

    // ---- Closure entry narration ----
    if (fn?.__node?.type === "ArrowFunctionExpression") {
        
        // ⭐ NEW: Create a dedicated step for entering closure
        ctx.logger.log(node.loc.start.line - 1);

        const params = fn.__params.map((p:any) => p.name);

        // parameter values
        const paramPairs = params.map((p:any, i:number) => `${p} = ${JSON.stringify(args[i])}`);

        // captured values
        let capturedPairs: string[] = [];
        try {
            let currentEnv = fn.__env;
            const captured: {[key: string]: any} = {};
            while(currentEnv && currentEnv.outer) {
                const envBindings = (currentEnv.outer.record as any).bindings;
                if (envBindings) {
                    for (const key of envBindings.keys()) {
                        if (!(key in captured)) {
                           captured[key] = envBindings.get(key)?.value;
                        }
                    }
                }
                currentEnv = currentEnv.outer;
            }

            capturedPairs = Object.entries(captured)
                .filter(([key]) => params.indexOf(key) === -1) // Exclude params from captured
                .map(([k, v]) => `${k} = ${JSON.stringify(v)}`);

        } catch(e) {
            console.error("Error capturing closure values", e);
        }

        ctx.logger.addFlow(`Entering closure (${paramPairs.join(", ")})`);

        if (capturedPairs.length > 0) {
            ctx.logger.addFlow(`Captured: ${capturedPairs.join(", ")}`);
        }
    }


    if (!fn.__ctx) {
      fn.__ctx = { logger: ctx.logger, stack: ctx.stack };
    }
    const result = fn.call(thisArg, args);
    if (isReturnSignal(result)) return result.value;
    return result;
  }

  throw new Error("Call of non-function value");
}

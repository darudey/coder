
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

  if (value?.__node?.type === "ArrowFunctionExpression")
    return "(arrow function)";

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
      
  ctx.logger.addFlow(
    `Calling function ${calleeName}(${args
      .map((a) => JSON.stringify(a))
      .join(", ")})`
  );

  // PREDICT NEXT-STEP for ALL function types
  if (calleeVal?.__node) {
    const body = calleeVal.__node.body;
    if (body?.loc) {
      const line = body.type === "BlockStatement"
          ? getFirstMeaningfulStatement(body)?.loc.start.line - 1
          : body.loc.start.line - 1;

      const message = body.type === "BlockStatement"
        ? `Next Step → ${displayHeader(calleeVal.__node, ctx.logger.getCode())}`
        : `Evaluate arrow body: ${displayHeader(body, ctx.logger.getCode())}`;

      ctx.logger.setNext(line, message);
    }
  }


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
    if (!fn.__ctx)
      fn.__ctx = { logger: ctx.logger, stack: ctx.stack };
      
    if (fn.__node.type === "ArrowFunctionExpression") {
        const captured: any = {};
        let currentEnv = fn.__env.outer;
        while(currentEnv) {
            const bindings = (currentEnv.record as any).bindings;
            if (bindings) {
                for (const key of bindings.keys()) {
                    if (!(key in captured)) {
                       captured[key] = bindings.get(key)?.value;
                    }
                }
            }
            currentEnv = currentEnv.outer;
        }

        const paramString = fn.__params.map((p, i) => `${p.name} = ${JSON.stringify(args[i])}`).join(', ');

        ctx.logger.addFlow(`Entering closure (${paramString})`);

        const capturedList = Object.keys(captured).map(k => `${k} = ${JSON.stringify(captured[k])}`).join(', ');
        if (capturedList) {
            ctx.logger.addFlow(`Captured: ${capturedList}`);
        }
    }
      
    const result = fn.call(thisArg, args);
    if (isReturnSignal(result)) return result.value;
    return result;
  }

  throw new Error("Call of non-function value");
}

// src/engine/expressions/evalCall.ts
import type { EvalContext } from "../types";
import { evaluateExpression } from "../evaluator";
import { isUserFunction, FunctionValue } from "../values";
import { isReturnSignal } from "../signals";
import { evalMemberTarget } from "./evalMember";
import { getFirstMeaningfulStatement, displayHeader } from "../next-step-helpers";

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

  const calleeName =
    node.callee.type === "Identifier"
      ? node.callee.name
      : node.callee.type === "MemberExpression"
      ? node.callee.property.name
      : "<call>";
      
  ctx.logger.addFlow(
    `Calling function ${calleeName}(${args
      .map((a) => JSON.stringify(a))
      .join(", ")})`
  );

  // PREDICT NEXT-STEP for ARROW FUNCTION EXPRESSION
  if (calleeVal?.__node?.type === "ArrowFunctionExpression") {
    const body = calleeVal.__node.body;

    if (body?.loc) {
      const preview =
        body.type === "BlockStatement"
          ? getFirstMeaningfulStatement(body)?.loc?.start.line - 1
          : body.loc.start.line - 1;

      ctx.logger.setNext(
        preview,
        `Next Step → ${displayHeader(body, ctx.logger.getCode())}`
      );
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
    const result = fn.call(thisArg, args);
    if (isReturnSignal(result)) return result.value;
    return result;
  }

  throw new Error("Call of non-function value");
}

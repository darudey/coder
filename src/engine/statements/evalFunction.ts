
// src/engine/statements/evalFunction.ts

import type { EvalContext } from "../types";
import {
  EnvironmentRecord,
  LexicalEnvironment as LexEnv,
} from "../environment";
import { createFunction, FunctionValue } from "../values";
import { hoistProgram } from "../hoist";
import { evaluateBlockBody } from "../evaluator";
import { isReturnSignal } from "../signals";
import {
  getFirstMeaningfulStatement,
  displayHeader,
} from "../next-step-helpers";

export function evalFunctionDeclaration(node: any, ctx: EvalContext) {
  const name = node.id?.name || "<anonymous>";
  const definingEnv = ctx.env;

  // --- Create the function value ---
  const impl = function (this: FunctionValue, thisArg: any, args: any[]) {
    const funcName = node.id?.name || "Function";

    // 1. Create execution environment for the call
    const fnEnv = new LexEnv(
      funcName,
      "function",
      new EnvironmentRecord(),
      this.__env // closure link
    );

    // Bind parameters
    (node.params ?? []).forEach((param: any, index: number) => {
      if (param.type === "Identifier") {
        fnEnv.record.createMutableBinding(param.name, "var", args[index], true);
      }
    });

    // 2. Use caller logger + stack
    const logger = this.__ctx?.logger || ctx.logger;
    const stack = this.__ctx?.stack || ctx.stack;

    // Resolve this-value
    let callThisValue = thisArg;
    if (node.type === "ArrowFunctionExpression") {
      try {
        callThisValue = this.__env.get("this");
      } catch {
        callThisValue = undefined;
      }
    }

    // 3. Log entering function
    logger.setCurrentEnv(fnEnv);
    if (node.loc) logger.log(node.loc.start.line - 1);
    logger.addFlow(`Entering function ${funcName}`);

    // Predict first step inside body
    const body = node.body;
    const firstStmt =
      body && body.type === "BlockStatement"
        ? getFirstMeaningfulStatement(body)
        : body;

    if (firstStmt?.loc) {
      logger.setNext(
        firstStmt.loc.start.line - 1,
        `Next Step → ${displayHeader(firstStmt, logger.getCode())}`
      );
    }

    // Build call context
    const innerCtx: EvalContext = {
      ...ctx,
      env: fnEnv,
      thisValue: callThisValue,
      logger,
      stack,
      nextStatement: undefined,
    };

    // 4. Push onto call stack
    stack.push(funcName);

    // 5. Execute function body
    let result: any;

    if (body && body.type === "BlockStatement") {
      hoistProgram({ body: body.body }, fnEnv);
      result = evaluateBlockBody(body.body, innerCtx);
    }

    // 6. Pop stack & restore environment
    stack.pop();
    logger.addFlow(`Returning from function ${funcName}`);
    logger.setCurrentEnv(this.__env);

    // 7. Handle return or undefined
    if (isReturnSignal(result)) return result.value;
    return undefined;
  };

  // --- Create function and attach AST node ---
  const fn = createFunction(definingEnv, node.params ?? [], node.body, impl);
  (fn as any).__node = node;

  // --- Initialize hoisted binding with runtime function value ---
  ctx.env.record.initializeBinding(name, fn);

  // --- Keep only a small flow log (do NOT force next-step) ---
  ctx.logger.addFlow(`Declared function ${name}`);
}

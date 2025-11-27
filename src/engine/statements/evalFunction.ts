
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

  // --- FUNCTION IMPLEMENTATION ---
  const impl = function (this: FunctionValue, thisArg: any, args: any[]) {
    const funcName = node.id?.name || "Function";

    // 1. Create execution env
    const fnEnv = new LexEnv(
      funcName,
      "function",
      new EnvironmentRecord(),
      this.__env
    );

    // Bind parameters
    (node.params ?? []).forEach((param: any, index: number) => {
      if (param.type === "Identifier") {
        fnEnv.record.createMutableBinding(
          param.name,
          "var",
          args[index],
          true
        );
      }
    });

    // 2. Logger + stack from call
    const logger = this.__ctx?.logger || ctx.logger;
    const stack = this.__ctx?.stack || ctx.stack;

    // 3. Determine `this` value
    let callThisValue = thisArg;
    if (node.type === "ArrowFunctionExpression") {
      try {
        callThisValue = this.__env.get("this");
      } catch {
        callThisValue = undefined;
      }
    }

    // 4. Log entry
    logger.setCurrentEnv(fnEnv);
    if (node.loc) {
      logger.log(node.loc.start.line - 1);
    }
    logger.addFlow(`Entering function ${funcName}`);

    // Predict next step inside body
    const body = node.body;
    const firstStmt =
      body && body.type === "BlockStatement"
        ? getFirstMeaningfulStatement(body)
        : body;

    if (firstStmt?.loc) {
      logger.setNext(
        firstStmt.loc.start.line - 1,
        `Next Step → ${displayHeader(
          firstStmt,
          logger.getCode()
        )}`
      );
    }

    // 5. Build call context
    const innerCtx: EvalContext = {
      ...ctx,
      env: fnEnv,
      thisValue: callThisValue,
      logger,
      stack,
      nextStatement: undefined,
    };

    // 6. Push to callstack
    stack.push(funcName);

    // 7. Execute function body
    let result: any = undefined;

    if (body && body.type === "BlockStatement") {
      hoistProgram({ body: body.body }, fnEnv);
      result = evaluateBlockBody(body.body, innerCtx);
    }

    // 8. Pop stack
    stack.pop();

    // 🔥 PATCH — cleaner return flow (NO spam, no nested dumping)
    const returnValue = isReturnSignal(result) ? result.value : undefined;
    logger.addFlow(
      `Return → ${funcName} returns ${JSON.stringify(returnValue)}`
    );

    // Restore environment
    logger.setCurrentEnv(this.__env);

    // 9. Forward actual return
    if (isReturnSignal(result)) {
      return result.value;
    }

    return undefined;
  };

  // Create FunctionValue
  const fn = createFunction(definingEnv, node.params ?? [], node.body, impl);
  (fn as any).__node = node;

  // Initialize hoisted binding
  ctx.env.record.initializeBinding(name, fn);

  // Simple declaration flow
  ctx.logger.addFlow(`Declared function ${name}`);
}

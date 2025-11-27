
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

  // === Function Implementation ===
  const impl = function (this: FunctionValue, thisArg: any, args: any[]) {
    const funcName = name;

    const fnEnv = new LexEnv(
      funcName,
      "function",
      new EnvironmentRecord(),
      this.__env  // closure parent
    );

    // bind params
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

    // resolve logger & call stack
    const logger = this.__ctx?.logger || ctx.logger;
    const stack = this.__ctx?.stack || ctx.stack;

    // set this binding
    let callThisValue = thisArg;
    if (node.type === "ArrowFunctionExpression") {
      callThisValue = this.__env.get("this");
    }

    logger.setCurrentEnv(fnEnv);
    logger.log(node.loc.start.line - 1);
    logger.addFlow(`Entering function ${funcName}`);

    const innerCtx: EvalContext = {
      ...ctx,
      env: fnEnv,
      thisValue: callThisValue,
      logger,
      stack,
      nextStatement: undefined,
    };

    const body = node.body;
    const firstStmt =
      body?.type === "BlockStatement"
        ? getFirstMeaningfulStatement(body)
        : body;

    if (firstStmt && firstStmt.loc) {
      logger.setNext(
        firstStmt.loc.start.line - 1,
        `Next Step → ${displayHeader(firstStmt, logger.getCode())}`
      );
    }

    // push call stack
    innerCtx.stack.push(funcName);

    let result: any;

    if (body?.type === "BlockStatement") {
      hoistProgram({ body: body.body }, fnEnv);
      result = evaluateBlockBody(body.body, innerCtx);
    }

    innerCtx.stack.pop();
    logger.addFlow(`Returning from function ${funcName}`);

    logger.setCurrentEnv(this.__env);

    if (isReturnSignal(result)) return result.value;
    return undefined;
  };

  // Create actual FunctionValue
  const fn = createFunction(definingEnv, node.params, node.body, impl);
  (fn as any).__node = node;

  ctx.env.record.initializeBinding(name, fn);

  if (node.loc) {
    ctx.logger.addFlow(`Declared function ${name}`);
    if (!ctx.logger.hasNext()) {
      ctx.logger.setNext(
        node.loc.start.line,
        `Next Step → function ${name} declared`
      );
    }
  }
}

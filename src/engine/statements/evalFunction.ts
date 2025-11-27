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

/**
 * Handles:
 *   function factorial(n) { ... }
 * Creates a user FunctionValue that:
 *   - Captures the defining LexicalEnvironment (for closures)
 *   - On call: creates its own function env, binds params,
 *     runs body via evaluateBlockBody, unwraps ReturnSignal,
 *     logs entry/exit and updates call stack.
 */
export function evalFunctionDeclaration(node: any, ctx: EvalContext) {
  const name = node.id?.name || "<anonymous>";
  const definingEnv = ctx.env;

  // The actual runtime behavior of the function when called
  const impl = function (this: FunctionValue, thisArg: any, args: any[]) {
    const funcName = node.id?.name || "Function";

    // --- 1. Build function execution environment ---
    const fnEnv = new LexEnv(
      funcName,
      "function",
      new EnvironmentRecord(),
      this.__env // closure over defining env
    );

    // Bind parameters (simple identifiers for now)
    (node.params ?? []).forEach((param: any, index: number) => {
      if (param.type === "Identifier") {
        fnEnv.record.createMutableBinding(
          param.name,
          "var",
          args[index],
          true
        );
      }
      // NOTE: more advanced patterns (destructuring, defaults) are handled
      // separately in your pattern binder – this is the simple path.
    });

    // --- 2. Logger + stack from the calling context (set in evalCall) ---
    const logger = (this.__ctx?.logger || ctx.logger);
    const stack = this.__ctx?.stack || ctx.stack;

    // Decide `this` value:
    // - Normal functions: use thisArg from call site
    // - Arrow functions (when we reuse this impl for them later): lexical this
    let callThisValue = thisArg;
    const nodeType = node.type || this.__node?.type;
    if (nodeType === "ArrowFunctionExpression") {
      try {
        callThisValue = this.__env.get("this");
      } catch {
        callThisValue = undefined;
      }
    }

    // --- 3. Switch logger to function env & log entry ---
    logger.setCurrentEnv(fnEnv);
    // create a timeline step for "entering function"
    if (node.loc) {
      logger.log(node.loc.start.line - 1);
    }
    logger.addFlow(`Entering function ${funcName}`);

    // Build inner EvalContext for this call
    const innerCtx: EvalContext = {
      ...ctx,
      env: fnEnv,
      thisValue: callThisValue,
      logger,
      stack,
      nextStatement: undefined,
    };

    // Predict first statement inside the function for "Next Step"
    const body = node.body;
    const firstStmt =
      body && body.type === "BlockStatement"
        ? getFirstMeaningfulStatement(body)
        : body;

    if (firstStmt && firstStmt.loc) {
      logger.setNext(
        firstStmt.loc.start.line - 1,
        `Next Step → ${displayHeader(firstStmt, logger.getCode())}`
      );
    }

    // --- 4. Push onto call stack ---
    const stackLabel = funcName || "<anonymous>";
    innerCtx.stack.push(stackLabel);

    // --- 5. Hoist inner declarations, then execute body ---
    let result: any;

    if (body && body.type === "BlockStatement") {
      // Hoist inner functions/vars inside function body
      hoistProgram({ body: body.body }, fnEnv);

      result = evaluateBlockBody(body.body, innerCtx);
    } else {
      // For function declarations we always have BlockStatement in normal JS,
      // but we keep this branch to be generic.
      result = undefined;
    }

    // --- 6. Pop stack & restore env on logger ---
    innerCtx.stack.pop();
    logger.addFlow(`Returning from function ${funcName}`);
    logger.setCurrentEnv(this.__env);

    // --- 7. Handle return signal or implicit undefined ---
    if (isReturnSignal(result)) {
      return result.value;
    }
    return undefined;
  };

  // Create the function value tied to the defining environment
  const fn = createFunction(definingEnv, node.params ?? [], node.body, impl);
  (fn as any).__node = node; // keep AST node for future features

  // Initialize the pre-hoisted binding with the actual function
  ctx.env.record.initializeBinding(name, fn);

  // Optional: add a nice flow message for the declaration itself
  if (node.loc) {
    ctx.logger.addFlow(`Declared function ${name}`);
    // Don't override an existing nextStep set by enclosing control-flow.
    if (!ctx.logger.hasNext()) {
      ctx.logger.setNext(
        node.loc.start.line,
        `Next Step → ${name} declaration completed`
      );
    }
  }
}

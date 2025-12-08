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

// helper to collect captured variables using shared logic
import { collectCapturedVariables } from "../expressions/evalCall";

export function evalFunctionDeclaration(
  node: any,
  ctx: EvalContext
) {
  const name = node.id?.name || "<anonymous>";
  const definingEnv = ctx.env;

  // --- FUNCTION IMPLEMENTATION ---
  const impl = function (
    this: FunctionValue,
    thisArg: any,
    args: any[]
  ) {
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

    // 4. Log entry: use first meaningful statement so the entry step points to real code
    logger.setCurrentEnv(fnEnv);
    if (node.loc) {
      let entryLine = node.loc.start.line - 1;

      if (node.body?.type === "BlockStatement") {
        const first = getFirstMeaningfulStatement(node.body);
        if (first?.loc) {
          entryLine = first.loc.start.line - 1;
        }
      } else if (node.body?.loc) {
        // if body is expression (arrow with expr), point at the body line
        entryLine = node.body.loc.start.line - 1;
      }

      logger.log(entryLine);
      logger.addFlow(`Entering function ${funcName}`);

      // Attach metadata for runtime function entry (callDepth will be stack length before push)
      logger.updateMeta({
        kind: "FunctionEntry",
        functionName: funcName,
        signature: node.range ? logger.getCode().substring(node.range[0], node.range[1]) : undefined,
        callDepth: stack.length + 1,
        activeScope: fnEnv.name,
      });
    }

    // Predict next step inside body (first meaningful inside block / or the body itself)
    const body = node.body;
    const firstStmt =
      body && body.type === "BlockStatement"
        ? getFirstMeaningfulStatement(body)
        : body;

    if (firstStmt?.loc) {
        const ln = firstStmt.loc.start.line;
        const lineText = logger.getCode().split("\n")[ln - 1].trim();

        logger.setNext(
          ln - 1,
          `Next Step → ${lineText} (line ${ln})`
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
    } else if (body) {
      // expression body (arrow or function returning expression) — evaluate it
      // evaluateExpression will run via expressions path normally; but for declarations it's rare.
      // Keep behavior consistent: evaluate with innerCtx if needed (left intentionally minimal)
    }

    // 8. Pop stack
    stack.pop();

    // Restore environment
    logger.setCurrentEnv(this.__env);

    if (isReturnSignal(result)) {
      return result.value;
    }

    return undefined;
  };

  // Create FunctionValue
  const fn = createFunction(
    definingEnv,
    node.params ?? [],
    node.body,
    impl
  );
  (fn as any).__node = node;

  // Initialize hoisted binding
  ctx.env.record.initializeBinding(name, fn);

  // Simple declaration flow
  ctx.logger.addFlow(`Declared function ${name}`);

  // Record closure/creation metadata on this declaration step.
  try {
    const sig = node.range ? ctx.logger.getCode().substring(node.range[0], node.range[1]) : undefined;
    const captured = collectCapturedVariables(fn);
    const last = ctx.logger.peekLastStep();
    ctx.logger.updateMeta({
      kind: "ClosureCreated",
      functionName: name,
      signature: sig,
      activeScope: definingEnv.name,
      capturedVariables: captured,
      capturedAtStep: last ? last.step : undefined,
    });
  } catch {
    // never throw from metadata collection
  }

  // After declaring the function, keep next-step pointing to the parent's nextStatement (first real executable)
  if (ctx.nextStatement) {
    const ln = ctx.nextStatement.loc.start.line;
    const lineText = ctx.logger.getCode().split("\n")[ln - 1].trim();
    ctx.logger.setNext(
      ln - 1,
      `Next Step → ${lineText} (line ${ln})`
    );
  } else {
    ctx.logger.setNext(null, "End of block");
  }
}

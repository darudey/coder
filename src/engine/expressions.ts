// src/engine/expressions.ts
// Pure expression evaluator — no statement logic.
// This file is imported by evaluator.ts and next-step-helpers.ts.

import type { EvalContext } from "./types";
import {
  getProperty,
  setProperty,
  isUserFunction,
  createFunction,
  FunctionValue,
} from "./values";

import { evalArray } from "./expressions/evalArray";
import { evalAssignment } from "./expressions/evalAssignment";
import { evalBinary } from "./expressions/evalBinary";
import { evalCall } from "./expressions/evalCall";
import { evalConditional } from "./expressions/evalConditional";
import { evalIdentifier } from "./expressions/evalIdentifier";
import { evalLogical } from "./expressions/evalLogical";
import { evalMember } from "./expressions/evalMember";
import { evalNew } from "./expressions/evalNew";
import { evalObject } from "./expressions/evalObject";
import { evalUnary } from "./expressions/evalUnary";
import { evalUpdateExpression } from "./expressions/evalUpdate";

import { EnvironmentRecord, LexicalEnvironment } from "./environment";
import { hoistProgram } from "./hoist";
import { evaluateBlockBody } from "./evaluator";
import { isReturnSignal, /* makeReturn if you have it */ } from "./signals";
import {
  getFirstMeaningfulStatement,
  displayHeader,
} from "./next-step-helpers";

//
// ──────────────────────────────────────────────
//   Helper: resolve MemberExpression target
// ──────────────────────────────────────────────
//
export function resolveMember(node: any, ctx: EvalContext) {
  const obj = evaluateExpression(node.object, ctx);

  let prop: any;
  if (node.computed) {
    prop = evaluateExpression(node.property, ctx);
  } else {
    prop = node.property.name;
  }

  return { obj, prop };
}

//
// ──────────────────────────────────────────────
//   Shared helper: build function value
//   Used by FunctionExpression & ArrowFunctionExpression
// ──────────────────────────────────────────────
//
function buildFunctionValue(node: any, ctx: EvalContext): FunctionValue {
  const definingEnv = ctx.env;

  const impl = function (
    this: FunctionValue,
    thisArg: any,
    args: any[]
  ) {
    const funcName = node.id?.name || "Function";

    // 1. Create execution environment for this call
    const fnEnv = new LexicalEnvironment(
      funcName,
      "function",
      new EnvironmentRecord(),
      this.__env
    );

    // 2. Bind parameters
    (node.params ?? []).forEach((param: any, index: number) => {
      if (param.type === "Identifier") {
        fnEnv.record.createMutableBinding(
          param.name,
          "var",
          args[index],
          true
        );
      }
      // (You can extend later for patterns, defaults, rest, etc.)
    });

    // 3. Logger + stack from call context
    const logger = this.__ctx?.logger || ctx.logger;
    const stack = this.__ctx?.stack || ctx.stack;

    // 4. Determine `this` value
    let callThisValue = thisArg;
    if (node.type === "ArrowFunctionExpression") {
      // Arrow functions capture lexical this
      try {
        callThisValue = this.__env.get("this");
      } catch {
        callThisValue = undefined;
      }
    }

    // 5. Log function entry
    logger.setCurrentEnv(fnEnv);
    if (node.loc) {
      logger.log(node.loc.start.line - 1);
      logger.addFlow(`Entering function ${funcName}`);
    }

    // 6. Predict next step inside body
    const body = node.body;
    let firstStmt: any = null;

    if (body && body.type === "BlockStatement") {
      firstStmt = getFirstMeaningfulStatement(body);
    } else {
      // Arrow with expression body
      firstStmt = body;
    }

    if (firstStmt?.loc) {
      logger.setNext(
        firstStmt.loc.start.line - 1,
        `Next Step → ${displayHeader(firstStmt, logger.getCode())}`
      );
    }

    // 7. Build inner EvalContext
    const innerCtx: EvalContext = {
      ...ctx,
      env: fnEnv,
      thisValue: callThisValue,
      logger,
      stack,
      nextStatement: undefined,
    };

    // 8. Push to callstack
    stack.push(funcName);

    // 9. Execute body
    let result: any = undefined;

    if (body && body.type === "BlockStatement") {
      // Classic function / arrow with block body
      hoistProgram({ body: body.body }, fnEnv);
      result = evaluateBlockBody(body.body, innerCtx);
    } else {
      // Arrow with expression body → implicit return
      const value = evaluateExpression(body, innerCtx);
      // fabricate a ReturnSignal-like object
      result = { __type: "Return", value };
    }

    // 10. Pop from callstack
    stack.pop();

    const returnValue = isReturnSignal(result)
      ? result.value
      : undefined;

    logger.addFlow(
      `Return → ${funcName} returns ${JSON.stringify(returnValue)}`
    );

    // Restore outer env for logger
    logger.setCurrentEnv(this.__env);

    if (isReturnSignal(result)) {
      return result.value;
    }

    // No explicit return → undefined
    return undefined;
  };

  // Create the actual function value object
  const fn = createFunction(
    definingEnv,
    node.params ?? [],
    node.body,
    impl
  );
  (fn as any).__node = node;

  return fn;
}

//
// ──────────────────────────────────────────────
//   MAIN evaluateExpression
// ──────────────────────────────────────────────
//

const expressionEvaluators: {
  [type: string]: (node: any, ctx: EvalContext) => any;
} = {
  Identifier: evalIdentifier,
  Literal: (node: any) => node.value,
  ThisExpression: (node: any, ctx: EvalContext) => ctx.thisValue,

  ArrayExpression: evalArray,
  ObjectExpression: evalObject,

  // 🔥 FIXED: now use proper function value with closure + logging
  FunctionExpression: (node: any, ctx: EvalContext) =>
    buildFunctionValue(node, ctx),

  ArrowFunctionExpression: (node: any, ctx: EvalContext) =>
    buildFunctionValue(node, ctx),

  UnaryExpression: evalUnary,
  UpdateExpression: evalUpdateExpression,
  BinaryExpression: evalBinary,
  AssignmentExpression: evalAssignment,
  LogicalExpression: evalLogical,
  MemberExpression: evalMember,
  ConditionalExpression: evalConditional,
  CallExpression: evalCall,
  NewExpression: evalNew,

  TemplateLiteral: (node: any, ctx: EvalContext) => {
    let out = "";
    for (let i = 0; i < node.quasis.length; i++) {
      out += node.quasis[i].value.raw;
      if (node.expressions[i]) {
        const v = evaluateExpression(node.expressions[i], ctx);
        out += String(v);
      }
    }
    return out;
  },

  ChainExpression: (node: any, ctx: EvalContext) => {
    return evaluateExpression(node.expression, ctx);
  },
};

export function evaluateExpression(node: any, ctx: EvalContext): any {
  if (!node) return;

  // SAFE MODE: preview only (used for Next-Step prediction)
  if (ctx.safe) {
    switch (node.type) {
      // These are safe to evaluate fully
      case "Identifier":
      case "Literal":
      case "BinaryExpression":
      case "LogicalExpression":
        break;

      // These have potential side effects and should be blocked
      case "CallExpression":
        return "[Side Effect]";

      case "AssignmentExpression":
      case "UpdateExpression":
        // NOTE: this is a bit simplified; you can refine later
        if ((node as any).argument?.type === "Identifier") {
          return ctx.env.get((node as any).argument.name);
        }
        return undefined;

      default:
        break;
    }
  }

  const evaluator = expressionEvaluators[node.type];
  if (evaluator) {
    return evaluator(node, ctx);
  }

  return undefined;
}

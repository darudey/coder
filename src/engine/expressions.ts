// src/engine/expressions.ts
// Pure expression evaluator — no statement logic.

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
import { isReturnSignal, makeReturn } from "./signals";
import {
  getFirstMeaningfulStatement,
  displayHeader,
} from "./next-step-helpers";

//
// Helper: resolve MemberExpression target
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
// Shared helper: build function value (used by FunctionExpression & ArrowFunctionExpression)
//
function buildFunctionValue(node: any, ctx: EvalContext): FunctionValue {
  const definingEnv = ctx.env;

  const impl = function (
    this: FunctionValue,
    thisArg: any,
    args: any[]
  ) {
    const isArrow = node.type === "ArrowFunctionExpression";

    const funcName =
      node.id?.name ||
      (isArrow ? "(arrow closure)" : "Function");

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
    });

    // 3. Logger + stack from call context
    const logger = this.__ctx?.logger || ctx.logger;
    const stack = this.__ctx?.stack || ctx.stack;

    // 4. Determine `this` value
    let callThisValue = thisArg;
    if (isArrow) {
      try {
        callThisValue = this.__env.get("this");
      } catch {
        callThisValue = undefined;
      }
    }

    // 5. Coordinate step creation with evalCall
    logger.setCurrentEnv(fnEnv);
    if (node.loc) {
      if (isArrow && node.body?.loc) {
        // DO NOT create a new arrow step to avoid duplicate steps.
        // evalCall created a step at the arrow body line; here we ensure we don't create a second.
        // do nothing — evaluateCall handles next-step for arrows
      } else if (!isArrow) {
        // Normal functions create their own entry step.
        logger.log(node.loc.start.line - 1);
        logger.addFlow(`Entering function ${funcName}`);
      }
    }

    const body = node.body;

    // 6. Predict next step inside block functions
    if (body && body.type === "BlockStatement") {
      const firstStmt = getFirstMeaningfulStatement(body);
      if (firstStmt?.loc) {
        logger.setNext(
          firstStmt.loc.start.line - 1,
          `Next Step → ${displayHeader(firstStmt, logger.getCode())}`
        );
      }
    }

    // 7. Inner EvalContext
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

    let result: any = undefined;

    if (body && body.type === "BlockStatement") {
      // Classic function
      hoistProgram({ body: body.body }, fnEnv);
      result = evaluateBlockBody(body.body, innerCtx);
    } else {
      // Arrow with EXPRESSION body (only logged here, NEVER in evalCall)
      if (body?.loc && body.range) {
        const slice = logger
          .getCode()
          .slice(body.range[0], body.range[1])
          .trim();
        logger.addFlow(`Evaluating arrow body: ${slice}`);
      }

      const value = evaluateExpression(body, innerCtx);

      logger.addExpressionEval(body, value);
      logger.addExpressionContext(body, "Arrow function body");
      logger.addFlow(`Arrow body result → ${JSON.stringify(value)}`);
      logger.addFlow(`Function complete → returned ${JSON.stringify(value)}`);

      logger.setNext(null, "Return: control returns to caller");
      result = makeReturn(value);
    }

    // 9. Pop from callstack
    stack.pop();

    // Restore outer env for logger
    logger.setCurrentEnv(this.__env);

    // 10. Unwrap ReturnSignal to actual value (and print small post-return narration)
    if (isReturnSignal(result)) {
      try {
        logger.addFlow(`(callsite) returned → ${JSON.stringify(result.value)}`);
      } catch {
        // ignore
      }
      return result.value;
    }

    return undefined;
  };

  // Create function value object
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
// main evaluateExpression map
//
const expressionEvaluators: {
  [type: string]: (node: any, ctx: EvalContext) => any;
} = {
  Identifier: evalIdentifier,
  Literal: (node: any) => node.value,
  ThisExpression: (node: any, ctx: EvalContext) => ctx.thisValue,

  ArrayExpression: evalArray,
  ObjectExpression: evalObject,

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
      case "Identifier":
      case "Literal":
      case "BinaryExpression":
      case "LogicalExpression":
        break;

      case "CallExpression":
        return "[Side Effect]";

      case "AssignmentExpression":
      case "UpdateExpression":
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

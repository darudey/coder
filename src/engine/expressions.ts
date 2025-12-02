// src/engine/expressions.ts
//
// FINAL PHASE-2 VERSION
// • No duplicate arrow steps
// • Arrow and normal functions cleanly separated
// • Teaching-friendly return narration
// • Works with evalCall Phase-2 patches
//

import type { EvalContext } from "./types";
import {
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

// ---------------------------------------------------------------
// Helper: resolve MemberExpression
// ---------------------------------------------------------------
export function resolveMember(node: any, ctx: EvalContext) {
  const obj = evaluateExpression(node.object, ctx);

  let prop: any;
  if (node.computed) prop = evaluateExpression(node.property, ctx);
  else prop = node.property.name;

  return { obj, prop };
}

// ---------------------------------------------------------------
// buildFunctionValue — the HEART of function execution
// ---------------------------------------------------------------
function buildFunctionValue(node: any, ctx: EvalContext): FunctionValue {
  const definingEnv = ctx.env;

  const impl = function (this: FunctionValue, thisArg: any, args: any[]) {
    const isArrow = node.type === "ArrowFunctionExpression";
    const funcName =
      node.id?.name || (isArrow ? "(arrow closure)" : "Function");

    // Create inner function environment (lexical scope)
    const fnEnv = new LexicalEnvironment(
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

    // Setup logger & stack
    const logger = this.__ctx?.logger || ctx.logger;
    const stack = this.__ctx?.stack || ctx.stack;

    // Determine `this` (arrows capture lexical this)
    let callThisValue = thisArg;
    if (isArrow) {
      try {
        callThisValue = this.__env.get("this");
      } catch {
        callThisValue = undefined;
      }
    }

    // ---------------------------------------------
    // Step creation rules (AVOIDS ARROW DUPLICATES)
    // ---------------------------------------------
    logger.setCurrentEnv(fnEnv);

    if (node.loc) {
      if (!isArrow) {
        // Normal functions always create an entry step
        logger.log(node.loc.start.line - 1);
        logger.addFlow(`Entering function ${funcName}`);
      }
      // Arrows DO NOT create steps here (evalCall handles it)
    }

    const body = node.body;

    // Predict next-step for normal block functions only
    if (body && body.type === "BlockStatement") {
      const first = getFirstMeaningfulStatement(body);
      if (first?.loc) {
        logger.setNext(
          first.loc.start.line - 1,
          `Next Step → ${displayHeader(first, logger.getCode())}`
        );
      }
    }

    // Build inner evaluation context
    const innerCtx: EvalContext = {
      ...ctx,
      env: fnEnv,
      thisValue: callThisValue,
      logger,
      stack,
      nextStatement: undefined,
    };

    // Push call stack
    stack.push(funcName);

    let result: any;

    // -------------------------------------------------
    // CASE 1 — NORMAL FUNCTION WITH BLOCK BODY
    // -------------------------------------------------
    if (body && body.type === "BlockStatement") {
      hoistProgram({ body: body.body }, fnEnv);
      result = evaluateBlockBody(body.body, innerCtx);
    }

    // -------------------------------------------------
    // CASE 2 — ARROW FUNCTION WITH EXPRESSION BODY
    // -------------------------------------------------
    else {
      // Logging expression body (no step creation!)
      if (body?.loc && body.range) {
        const slice = logger.getCode().slice(body.range[0], body.range[1]).trim();
        logger.addFlow(`Evaluating arrow body: ${slice}`);
      }

      const value = evaluateExpression(body, innerCtx);

      logger.addExpressionEval(body, value);
      logger.addExpressionContext(body, "Arrow function body");

      logger.addFlow(`Arrow body result → ${JSON.stringify(value)}`);
      logger.addFlow(`Function complete → returned ${JSON.stringify(value)}`);

      // Next-step goes back to caller
      logger.setNext(null, "Return: control returns to caller");

      result = makeReturn(value);
    }

    // Pop stack
    stack.pop();

    // Restore env for logger
    logger.setCurrentEnv(this.__env);

    // Return value handling
    if (isReturnSignal(result)) {
      logger.addFlow(`(callsite) returned → ${JSON.stringify(result.value)}`);
      return result.value;
    }

    return undefined;
  };

  // Construct and return the function value object
  const fn = createFunction(definingEnv, node.params ?? [], node.body, impl);
  (fn as any).__node = node;
  return fn;
}

// ---------------------------------------------------------------
// Expression evaluators
// ---------------------------------------------------------------
const expressionEvaluators: Record<string, any> = {
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

  ChainExpression: (node: any, ctx: EvalContext) =>
    evaluateExpression(node.expression, ctx),
};

// ---------------------------------------------------------------
// evaluateExpression
// ---------------------------------------------------------------
export function evaluateExpression(node: any, ctx: EvalContext): any {
  if (!node) return;

  // Safe-mode (preview only)
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
        if (node.argument?.type === "Identifier") {
          return ctx.env.get(node.argument.name);
        }
        return undefined;
    }
  }

  const evaluator = expressionEvaluators[node.type];
  if (!evaluator) return undefined;

  return evaluator(node, ctx);
}

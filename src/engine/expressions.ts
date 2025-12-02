
// src/engine/expressions.ts
// (only the relevant function portion shown -- replace your current file with this full content)
import type { EvalContext } from "./types";
import { getProperty, setProperty, isUserFunction, createFunction, FunctionValue } from "./values";
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
import { getFirstMeaningfulStatement, displayHeader } from "./next-step-helpers";

export function resolveMember(node: any, ctx: EvalContext) {
  const obj = evaluateExpression(node.object, ctx);
  let prop: any;
  if (node.computed) prop = evaluateExpression(node.property, ctx);
  else prop = node.property.name;
  return { obj, prop };
}

function buildFunctionValue(node: any, ctx: EvalContext): FunctionValue {
  const definingEnv = ctx.env;
  const impl = function (this: FunctionValue, thisArg: any, args: any[]) {
    const isArrow = node.type === "ArrowFunctionExpression";
    const funcName = node.id?.name || (isArrow ? "(arrow closure)" : "Function");

    const fnEnv = new LexicalEnvironment(funcName, "function", new EnvironmentRecord(), this.__env);

    (node.params ?? []).forEach((param: any, index: number) => {
      if (param.type === "Identifier") {
        fnEnv.record.createMutableBinding(param.name, "var", args[index], true);
      }
    });

    const logger = this.__ctx?.logger || ctx.logger;
    const stack = this.__ctx?.stack || ctx.stack;

    let callThisValue = thisArg;
    if (isArrow) {
      try { callThisValue = this.__env.get("this"); } catch { callThisValue = undefined; }
    }

    logger.setCurrentEnv(fnEnv);

    // Coordination with evalCall: arrows may rely on evalCall to create the initial step.
    if (node.loc) {
      if (isArrow && node.body?.loc) {
        // Do not create a separate arrow step; keep step created by evalCall to avoid duplication.
        // However clear stale next-step if any:
        const entry = logger.peekLastStep();
        if (entry) logger.setNext(null, "", entry);
      } else if (!isArrow) {
        logger.log(node.loc.start.line - 1);
        logger.addFlow(`Entering function ${funcName}`);
      }
    }

    const body = node.body;
    if (body && body.type === "BlockStatement") {
      const firstStmt = getFirstMeaningfulStatement(body);
      if (firstStmt?.loc) {
        logger.setNext(firstStmt.loc.start.line - 1, `Next Step → ${displayHeader(firstStmt, logger.getCode())}`);
      }
    }

    const innerCtx: EvalContext = { ...ctx, env: fnEnv, thisValue: callThisValue, logger, stack, nextStatement: undefined };

    stack.push(funcName);

    let result: any = undefined;

    if (body && body.type === "BlockStatement") {
      hoistProgram({ body: body.body }, fnEnv);
      result = evaluateBlockBody(body.body, innerCtx);
    } else {
      // Arrow expression body
      const entry = logger.peekLastStep();
      if (body?.loc && body.range) {
        const slice = logger.getCode().slice(body.range[0], body.range[1]).trim();
        logger.addFlow(`Evaluating arrow body: ${slice}`);
        logger.setNext(null, "Evaluate arrow body", entry);
      }

      const value = evaluateExpression(body, innerCtx);

      if (body) {
        logger.addExpressionEval(body, value);
        logger.addExpressionContext(body, "Arrow function body");
        logger.addFlow(`Arrow body result → ${JSON.stringify(value)}`);
      }
      
      logger.addFlow(
        `The function finished running.\nReturned → ${JSON.stringify(value)}`
      );

      logger.setNext(null, "Return: control returns to caller");
      result = makeReturn(value);
    }

    stack.pop();
    logger.setCurrentEnv(this.__env);

    if (isReturnSignal(result)) {
        logger.addFlow(
            `The function finished running.\nReturned → ${JSON.stringify(result.value)}`
        );
        return result.value;
    }
    return undefined;
  };

  const fn = createFunction(definingEnv, node.params ?? [], node.body, impl);
  (fn as any).__node = node;
  return fn;
}

// expressionEvaluators and evaluateExpression remain the same — make sure CallExpression points to evalCall
const expressionEvaluators: { [type: string]: (node: any, ctx: EvalContext) => any } = {
  Identifier: evalIdentifier,
  Literal: (node: any) => node.value,
  ThisExpression: (node: any, ctx: EvalContext) => ctx.thisValue,
  ArrayExpression: evalArray,
  ObjectExpression: evalObject,
  FunctionExpression: (node: any, ctx: EvalContext) => buildFunctionValue(node, ctx),
  ArrowFunctionExpression: (node: any, ctx: EvalContext) => buildFunctionValue(node, ctx),
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
  ChainExpression: (node: any, ctx: EvalContext) => { return evaluateExpression(node.expression, ctx); },
};

export function evaluateExpression(node: any, ctx: EvalContext): any {
  if (!node) return;
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
  if (evaluator) return evaluator(node, ctx);
  return undefined;
}


// src/engine/expressions.ts
// Pure expression evaluator — no statement logic.
// This file is imported by evaluator.ts and next-step-helpers.ts.

import type { EvalContext } from "./types";
import {
  getProperty,
  setProperty,
  isUserFunction,
} from "./values";
import { evalArray } from './expressions/evalArray';
import { evalAssignment } from './expressions/evalAssignment';
import { evalBinary } from './expressions/evalBinary';
import { evalCall } from './expressions/evalCall';
import { evalConditional } from './expressions/evalConditional';
import { evalIdentifier } from './expressions/evalIdentifier';
import { evalLogical } from './expressions/evalLogical';
import { evalMember } from './expressions/evalMember';
import { evalNew } from './expressions/evalNew';
import { evalObject } from './expressions/evalObject';
import { evalUnary } from './expressions/evalUnary';
import { evalUpdate } from './expressions/evalUpdate';
import { createFunction } from './values';
import { isReturnSignal } from './signals';

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
//   MAIN evaluateExpression
// ──────────────────────────────────────────────
//

const expressionEvaluators: { [type: string]: (node: any, ctx: EvalContext) => any } = {
  "Identifier": evalIdentifier,
  "Literal": (node: any) => node.value,
  "ThisExpression": (node: any, ctx: EvalContext) => ctx.thisValue,
  "ArrayExpression": evalArray,
  "ObjectExpression": evalObject,
  "FunctionExpression": (node: any, ctx: EvalContext) => createFunction(node, ctx.env),
  "ArrowFunctionExpression": (node: any, ctx: EvalContext) => createFunction(node, ctx.env),
  "UnaryExpression": evalUnary,
  "UpdateExpression": evalUpdate,
  "BinaryExpression": evalBinary,
  "AssignmentExpression": evalAssignment,
  "LogicalExpression": evalLogical,
  "MemberExpression": evalMember,
  "ConditionalExpression": evalConditional,
  "CallExpression": evalCall,
  "NewExpression": evalNew,
  "TemplateLiteral": (node: any, ctx: EvalContext) => {
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
  "ChainExpression": (node: any, ctx: EvalContext) => {
      return evaluateExpression(node.expression, ctx);
  }
};


export function evaluateExpression(node: any, ctx: EvalContext): any {
  if (!node) return;

  // SAFE MODE: preview only (used for Next-Step prediction)
  if (ctx.safe) {
    switch (node.type) {
      case "Identifier": return ctx.env.get(node.name);
      case "Literal": return node.value;
      case "BinaryExpression": return undefined;
      case "LogicalExpression": return undefined;
      case "CallExpression": return "[Side Effect]";
      case "UpdateExpression":
        if (node.argument.type === 'Identifier') {
          return ctx.env.get(node.argument.name);
        }
        return undefined;
    }
  }
  
  const evaluator = expressionEvaluators[node.type];
  if (evaluator) {
      return evaluator(node, ctx);
  }

  return undefined;
}

// src/engine/evaluator.ts
import { EnvironmentRecord, LexicalEnvironment as LexEnv } from "./environment";
import type { TimelineLogger } from "./timeline";
import { hoistProgram } from "./hoist";
import { evalVariableDeclaration } from "./statements/evalDeclarations";

import type { EvalContext } from "./types";
import {
  makeThrow,
} from "./signals";
import {
  logIfRealStatement,
} from "./next-step";

import { evalExpressionStatement } from "./statements/evalExpressionStmt";
import { evalBlockStatement } from "./statements/evalBlock";
import { evalIfStatement } from "./statements/evalIf";
import { evalForStatement } from "./statements/evalFor";
import { evalWhileStatement } from "./statements/evalWhile";
import { evalReturnStatement } from "./statements/evalReturn";
import { evalBreakStatement } from "./statements/evalBreak";
import { evalContinueStatement } from "./statements/evalContinue";
import { evalSwitchStatement } from "./statements/evalSwitch";
import { evalTryStatement } from "./statements/evalTry";
import { evalFunctionDeclaration } from "./statements/evalFunction";
import { evalClassDeclaration } from "./statements/evalClass";
import { evalLabeledStatement } from "./statements/evalLabeled";
import { evalForInStatement } from "./statements/evalForIn";
import { evalForOfStatement } from "./statements/evalForOf";

import { evalIdentifier } from './expressions/evalIdentifier';
import { evalBinaryExpression } from './expressions/evalBinary';
import { evalLogicalExpression } from './expressions/evalLogical';
import { evalAssignmentExpression } from './expressions/evalAssignment';
import { evalUpdateExpression } from './expressions/evalUpdate';
import { evalCallExpression } from './expressions/evalCall';
import { evalMemberExpression } from './expressions/evalMember';
import { evalNewExpression } from './expressions/evalNew';
import { evalArrayExpression } from './expressions/evalArray';
import { evalObjectExpression } from './expressions/evalObject';
import { evalUnaryExpression } from './expressions/evalUnary';
import { evalConditionalExpression } from './expressions/evalConditional';

// ---------- MAIN ENTRY ----------
export function evaluateProgram(ast: any, ctx: EvalContext): any {
  hoistProgram(ast, ctx.env);
  return evaluateBlockBody(ast.body, ctx);
}

// ---------- BLOCK EVALUATION (sequential statements) ----------
export function evaluateBlockBody(body: any[], ctx: EvalContext): any {
  const { isReturnSignal, isBreakSignal, isContinueSignal, isThrowSignal } = require('./signals');
  let result: any;

  for (let i = 0; i < body.length; i++) {
    const stmt = body[i];

    // find next meaningful statement for next-step prediction
    let nextStmt: any = null;
    for (let j = i + 1; j < body.length; j++) {
      const candidate = body[j];
      if (candidate && candidate.type !== "EmptyStatement" && candidate.type !== "DebuggerStatement") {
        nextStmt = candidate;
        break;
      }
    }

    const statementCtx: EvalContext = { ...ctx, nextStatement: nextStmt };

    result = evaluateStatement(stmt, statementCtx);

    // propagate break/continue/return/throw up for loop/function handling
    if (isReturnSignal(result) || isBreakSignal(result) || isContinueSignal(result) || isThrowSignal(result)) {
      return result;
    }
  }

  return result;
}

// ---------- STATEMENT EVALUATION ----------
export function evaluateStatement(node: any, ctx: EvalContext): any {
  if (!node) return;

  logIfRealStatement(node, ctx);

  let result: any;

  switch (node.type) {
    case "VariableDeclaration":
      result = evalVariableDeclaration(node, ctx);
      break;

    case "ExpressionStatement":
      result = evalExpressionStatement(node, ctx);
      break;

    case "ReturnStatement":
      result = evalReturnStatement(node, ctx);
      break;

    case "IfStatement":
      result = evalIfStatement(node, ctx);
      break;

    case "BlockStatement":
      result = evalBlockStatement(node, ctx);
      break;

    case "ForStatement":
      result = evalForStatement(node, ctx);
      break;

    case "WhileStatement":
      result = evalWhileStatement(node, ctx);
      break;

    case "FunctionDeclaration":
      result = evalFunctionDeclaration(node, ctx);
      break;

    case "ClassDeclaration":
      result = evalClassDeclaration(node, ctx);
      break;

    case "BreakStatement":
      result = evalBreakStatement(node, ctx);
      break;

    case "ContinueStatement":
      result = evalContinueStatement(node, ctx);
      break;

    case "LabeledStatement":
      result = evalLabeledStatement(node, ctx);
      break;

    case "SwitchStatement":
      result = evalSwitchStatement(node, ctx);
      break;

    case "TryStatement":
      result = evalTryStatement(node, ctx);
      break;

    case "ForInStatement":
      result = evalForInStatement(node, ctx);
      break;

    case "ForOfStatement":
      result = evalForOfStatement(node, ctx);
      break;

    case "ThrowStatement":
      result = makeThrow(
        node.argument ? evaluateExpression(node.argument, ctx) : undefined
      );
      break;

    default:
      // unsupported statement types are ignored for now
      return;
  }

  // GLOBAL FALLBACK NEXT-STEP
  // If no specific next-step was set by clause/loop logic, use sequential prediction.
  if (!ctx.logger.hasNext()) {
    if (ctx.nextStatement) {
      const { displayHeader } = require("./next-step");
      ctx.logger.setNext(ctx.nextStatement.loc.start.line - 1, `Next Step → ${displayHeader(ctx.nextStatement, ctx.logger.getCode())}`);
    } else {
      ctx.logger.setNext(null, "End of block");
    }
  }

  return result;
}


// ---------- EXPRESSIONS ----------
export function evaluateExpression(node: any, ctx: EvalContext): any {
  if (!node) return;

  if (ctx.safe) {
    if (node.type === "AssignmentExpression") return undefined;
    if (node.type === "UpdateExpression") {
      if (node.argument.type === "Identifier") return ctx.env.get(node.argument.name);
      return undefined;
    }
    if (node.type === "CallExpression") return "[Side Effect]";
  }

  switch (node.type) {
    case "Identifier":
      return evalIdentifier(node, ctx);

    case "Literal":
      return node.value;

    case "BinaryExpression":
      return evalBinaryExpression(node, ctx);

    case "LogicalExpression":
      return evalLogicalExpression(node, ctx);

    case "AssignmentExpression":
      return evalAssignmentExpression(node, ctx);

    case "UpdateExpression":
      return evalUpdateExpression(node, ctx);

    case "CallExpression":
      return evalCallExpression(node, ctx);

    case "MemberExpression":
      return evalMemberExpression(node, ctx);
      
    case "ArrowFunctionExpression":
    case "FunctionExpression":
      const { createUserFunction } = require("./values");
      return createUserFunction(node, ctx.env);

    case "NewExpression":
      return evalNewExpression(node, ctx);

    case "ArrayExpression":
      return evalArrayExpression(node, ctx);

    case "ObjectExpression":
      return evalObjectExpression(node, ctx);

    case "ThisExpression":
      return ctx.thisValue;
    
    case "UnaryExpression":
      return evalUnaryExpression(node, ctx);
    
    case "ConditionalExpression":
      return evalConditionalExpression(node, ctx);

    default:
      // unsupported expression types return undefined
      return undefined;
  }
}

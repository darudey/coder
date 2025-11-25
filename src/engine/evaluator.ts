// src/engine/evaluator.ts
import type { EvalContext } from './types';
import { hoistProgram } from './hoist';

// Import statement evaluators
import { evalIf } from './statements/evalIf';
import { evalWhile } from './statements/evalWhile';
import { evalFor } from './statements/evalFor';
import { evalForIn } from './statements/evalForIn';
import { evalForOf } from './statements/evalForOf';
import { evalReturn } from './statements/evalReturn';
import { evalBlock } from './statements/evalBlock';
import { evalSwitch } from './statements/evalSwitch';
import { evalTry } from './statements/evalTry';
import { evalBreak } from './statements/evalBreak';
import { evalContinue } from './statements/evalContinue';
import { evalLabeled } from './statements/evalLabeled';
import { evalThrow } from './statements/evalThrow';
import { evalVariableDeclaration, evalFunctionDeclaration, evalClassDeclaration } from './statements/evalDeclarations';
import { evalExpressionStatement } from './statements/evalExpressionStatement';


// Import expression evaluators
import { evalIdentifier } from './expressions/evalIdentifier';
import { evalBinary } from './expressions/evalBinary';
import { evalLogical } from './expressions/evalLogical';
import { evalAssignment } from './expressions/evalAssignment';
import { evalUpdate } from './expressions/evalUpdate';
import { evalCall } from './expressions/evalCall';
import { evalMember } from './expressions/evalMember';
import { evalNew } from './expressions/evalNew';
import { evalArray } from './expressions/evalArray';
import { evalObject } from './expressions/evalObject';
import { evalUnary } from './expressions/evalUnary';
import { evalConditional } from './expressions/evalConditional';

import { isReturnSignal, isBreakSignal, isContinueSignal, isThrowSignal } from './signals';
import { setNextFromContext, getNextStatement } from './next-step';

// Main entry point for the interpreter
export function evaluateProgram(ast: any, ctx: EvalContext): any {
  hoistProgram(ast, ctx.env);
  return evaluateBlockBody(ast.body, ctx);
}

// Keep the core loop here as it's central
export function evaluateBlockBody(body: any[], ctx: EvalContext): any {
  let result: any;

  for (let i = 0; i < body.length; i++) {
    const stmt = body[i];
    const nextStmt = getNextStatement(body, i);
    const statementCtx: EvalContext = { ...ctx, nextStatement: nextStmt };

    result = evaluateStatement(stmt, statementCtx);

    if (isReturnSignal(result) || isBreakSignal(result) || isContinueSignal(result) || isThrowSignal(result)) {
      return result;
    }
  }

  return result;
}


// Acts as a router to the specific statement evaluation functions
export function evaluateStatement(node: any, ctx: EvalContext): any {
  if (!node) return;

  ctx.logger.log(node.loc.start.line - 1);

  let result: any;
  switch (node.type) {
    case 'IfStatement': result = evalIf(node, ctx); break;
    case 'WhileStatement': result = evalWhile(node, ctx); break;
    case 'ForStatement': result = evalFor(node, ctx); break;
    case 'ForInStatement': result = evalForIn(node, ctx); break;
    case 'ForOfStatement': result = evalForOf(node, ctx); break;
    case 'ReturnStatement': result = evalReturn(node, ctx); break;
    case 'SwitchStatement': result = evalSwitch(node, ctx); break;
    case 'TryStatement': result = evalTry(node, ctx); break;
    case 'BreakStatement': result = evalBreak(node, ctx); break;
    case 'ContinueStatement': result = evalContinue(node, ctx); break;
    case 'LabeledStatement': result = evalLabeled(node, ctx); break;
    case 'ThrowStatement': result = evalThrow(node, ctx); break;
    case 'ExpressionStatement': result = evalExpressionStatement(node, ctx); break;
    case 'BlockStatement': result = evalBlock(node, ctx); break;
    case 'FunctionDeclaration': result = evalFunctionDeclaration(node, ctx); break;
    case 'ClassDeclaration': result = evalClassDeclaration(node, ctx); break;
    case 'VariableDeclaration': result = evalVariableDeclaration(node, ctx); break;
    case 'EmptyStatement': break; // Do nothing
    case 'DebuggerStatement': break; // Do nothing
    default:
      console.warn(`Unsupported statement type: ${node.type}`);
      return;
  }
  
  setNextFromContext(ctx);
  return result;
}

// Acts as a router to the specific expression evaluation functions
export function evaluateExpression(node: any, ctx: EvalContext): any {
  if (!node) return;
  
  // Safety check for side-effects during 'safe' evaluations (e.g., in loop conditions)
  if (ctx.safe) {
    if (node.type === "AssignmentExpression" || node.type === "UpdateExpression" || node.type === "CallExpression") {
      return "[Side Effect]";
    }
  }
  
  switch (node.type) {
    case 'Identifier': return evalIdentifier(node, ctx);
    case 'Literal': return node.value;
    case 'ThisExpression': return ctx.thisValue;
    case 'BinaryExpression': return evalBinary(node, ctx);
    case 'LogicalExpression': return evalLogical(node, ctx);
    case 'AssignmentExpression': return evalAssignment(node, ctx);
    case 'UpdateExpression': return evalUpdate(node, ctx);
    case 'CallExpression': return evalCall(node, ctx);
    case 'MemberExpression': return evalMember(node, ctx);
    case 'NewExpression': return evalNew(node, ctx);
    case 'ArrayExpression': return evalArray(node, ctx);
    case 'ObjectExpression': return evalObject(node, ctx);
    case 'UnaryExpression': return evalUnary(node, ctx);
    case 'ConditionalExpression': return evalConditional(node, ctx);
    case 'FunctionExpression': return (require('./statements/evalDeclarations')).createUserFunction(node, ctx.env);
    case 'ArrowFunctionExpression': return (require('./statements/evalDeclarations')).createUserFunction(node, ctx.env);
    default:
      console.warn(`Unsupported expression type: ${node.type}`);
      return undefined;
  }
}


// src/engine/evaluator.ts

import type { EvalContext } from './types';
import { hoistProgram } from './hoist';
import { logIfRealStatement, displayHeader, getFirstMeaningfulStatement } from './next-step';

// Import statement evaluators
import { evalVariableDeclaration } from './statements/evalDeclarations';
import { evalExpressionStatement } from './statements/evalExpressionStmt';
import { evalReturnStatement } from './statements/evalReturn';
import { evalIfStatement } from './statements/evalIf';
import { evalBlockStatement } from './statements/evalBlock';
import { evalForStatement } from './statements/evalFor';
import { evalWhileStatement } from './statements/evalWhile';
import { evalFunctionDeclaration } from './statements/evalFunction';
import { evalClassDeclaration } from './statements/evalClass';
import { evalBreakStatement } from './statements/evalBreak';
import { evalContinueStatement } from './statements/evalContinue';
import { evalSwitchStatement } from './statements/evalSwitch';
import { evalTryStatement } from './statements/evalTry';
import { evalLabeledStatement } from './statements/evalLabeled';
import { evalForInStatement } from './statements/evalForIn';
import { evalForOfStatement } from './statements/evalForOf';

// Import expression evaluators
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

import { isReturnSignal, isBreakSignal, isContinueSignal, isThrowSignal, makeThrow } from './signals';

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
    case "LabeledStatement":
      result = evalLabeledStatement(node, ctx);
      break;
    case "ThrowStatement":
      result = makeThrow(
        node.argument ? evaluateExpression(node.argument, ctx) : undefined
      );
      break;
    default:
      return;
  }
  
  if (!ctx.logger.hasNext()) {
    if (ctx.nextStatement) {
      ctx.logger.setNext(ctx.nextStatement.loc.start.line - 1, `Next Step → ${displayHeader(ctx.nextStatement, ctx.logger.getCode())}`);
    } else {
      ctx.logger.setNext(null, "End of block");
    }
  }

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
    case 'BinaryExpression': return evalBinaryExpression(node, ctx);
    case 'LogicalExpression': return evalLogicalExpression(node, ctx);
    case 'AssignmentExpression': return evalAssignmentExpression(node, ctx);
    case 'UpdateExpression': return evalUpdateExpression(node, ctx);
    case 'CallExpression': return evalCallExpression(node, ctx);
    case 'MemberExpression': return evalMemberExpression(node, ctx);
    case 'NewExpression': return evalNewExpression(node, ctx);
    case 'ArrayExpression': return evalArrayExpression(node, ctx);
    case 'ObjectExpression': return evalObjectExpression(node, ctx);
    case 'UnaryExpression': return evalUnaryExpression(node, ctx);
    case 'ConditionalExpression': return evalConditionalExpression(node, ctx);
    case 'FunctionExpression': return (require('./statements/evalDeclarations')).createUserFunction(node, ctx.env);
    case 'ArrowFunctionExpression': return (require('./statements/evalDeclarations')).createUserFunction(node, ctx.env);
    default:
      console.warn(`Unsupported expression type: ${node.type}`);
      return undefined;
  }
}

function getNextStatement(body: any[], currentIndex: number): any | null {
  for (let j = currentIndex + 1; j < body.length; j++) {
    const candidate = body[j];
    if (candidate && candidate.type !== "EmptyStatement" && candidate.type !== "DebuggerStatement") {
      return candidate;
    }
  }
  return null;
}

// src/engine/evaluator.ts
// The main dispatcher for the JavaScript engine.
// It routes statements to their respective handler modules.

import type { EvalContext } from "./types";
import {
  isReturnSignal,
  isBreakSignal,
  isContinueSignal,
  isThrowSignal,
} from "./signals";
import {
  displayHeader,
  logIfRealStatement,
} from "./next-step-helpers";
import { hoistProgram } from "./hoist";

// Import statement evaluators
import { evalVariableDeclaration, evalFunctionDeclaration, evalClassDeclaration } from "./statements/evalDeclarations";
import { evalExpressionStatement } from "./statements/evalExpressionStmt";
import { evalReturnStatement } from "./statements/evalReturn";
import { evalIfStatement } from "./statements/evalIf";
import { evalBlockStatement } from "./statements/evalBlock";
import { evalForStatement } from "./statements/evalFor";
import { evalWhileStatement } from "./statements/evalWhile";
import { evalBreakStatement } from "./statements/evalBreak";
import { evalContinueStatement } from "./statements/evalContinue";
import { evalLabeled } from "./statements/evalLabeled";
import { evalSwitchStatement } from "./statements/evalSwitch";
import { evalTryStatement } from "./statements/evalTry";
import { evalForIn } from "./statements/evalForIn";
import { evalForOf } from "./statements/evalForOf";
import { evalThrow } from './statements/evalThrow';


// ---------- MAIN ENTRY ----------
export function evaluateProgram(ast: any, ctx: EvalContext): any {
  hoistProgram(ast, ctx.env);
  return evaluateBlockBody(ast.body, ctx);
}

// ---------- BLOCK EVALUATION (sequential statements) ----------
export function evaluateBlockBody(body: any[], ctx: EvalContext): any {
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


// ---------- STATEMENT ROUTER ----------
export function evaluateStatement(node: any, ctx: EvalContext): any {
  if (!node) return;

  // IMPORTANT:
  // We let WHILE handle its own logging per iteration in evalWhileStatement.
  if (node.type !== "WhileStatement") {
    logIfRealStatement(node, ctx);
  }

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
      result = evalLabeled(node, ctx);
      break;

    case "SwitchStatement":
      result = evalSwitchStatement(node, ctx);
      break;

    case "TryStatement":
      result = evalTryStatement(node, ctx);
      break;

    case "ForInStatement":
      result = evalForIn(node, ctx);
      break;

    case "ForOfStatement":
      result = evalForOf(node, ctx);
      break;

    case "ThrowStatement":
      result = evalThrow(node, ctx);
      break;

    default:
      // unsupported statement types are ignored for now
      return;
  }

  // GLOBAL FALLBACK NEXT-STEP
  // If no specific next-step was set by clause/loop logic, use sequential prediction.
  if (!ctx.logger.hasNext()) {
    if (ctx.nextStatement) {
      ctx.logger.setNext(
        ctx.nextStatement.loc.start.line - 1,
        `Next Step → ${displayHeader(ctx.nextStatement, ctx.logger.getCode())}`
      );
    } else {
      ctx.logger.setNext(null, "End of block");
    }
  }

  return result;
}

// Re-export from expressions for other modules
export { evaluateExpression } from './expressions';

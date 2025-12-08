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
import { displayHeader } from "./next-step-helpers";
import { hoistProgram } from "./hoist";

// Import statement evaluators
import {
  evalVariableDeclaration,
  evalClassDeclaration,
} from "./statements/evalDeclarations";
import { evalFunctionDeclaration } from "./statements/evalFunction";
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
import { evalThrow } from "./statements/evalThrow";

/**
 * Utility: find first meaningful (non-empty, non-debugger) statement in a list.
 * Returns null if none found.
 */
function findFirstMeaningfulStatement(body: any[] | undefined) {
  if (!Array.isArray(body)) return null;
  for (const candidate of body) {
    if (!candidate) continue;
    if (candidate.type === "EmptyStatement" || candidate.type === "DebuggerStatement")
      continue;
    return candidate;
  }
  return null;
}

// ---------- MAIN ENTRY ----------
export function evaluateProgram(ast: any, ctx: EvalContext): any {
  // Hoist first so the global env is prepared
  hoistProgram(ast, ctx.env);

  // Emit an initial "Step 1" raw snapshot so debugger has a full scope to display.
  // We mark it as initial by passing isInitialStep = true — logger will handle step numbering.
  try {
    // Log an initial step at "line 0". UI can interpret this as program-start snapshot.
    ctx.logger.log(0, true);

    // Predict the next real step (first meaningful statement) and set it for the initial snapshot.
    const first = findFirstMeaningfulStatement(ast.body);
    if (first && first.loc) {
      ctx.logger.setNext(
        first.loc.start.line - 1,
        `Next Step → ${displayHeader(first, ctx.logger.getCode())}`
      );
    } else {
      // fallback: end of block
      ctx.logger.setNext(null, "Program start — no statements");
    }
  } catch {
    // never let logger prediction crash program execution
  }

  return evaluateBlockBody(ast.body, ctx);
}

// ---------- BLOCK EVALUATION (sequential statements) ----------
export function evaluateBlockBody(
  body: any[],
  ctx: EvalContext
): any {
  let result: any;

  for (let i = 0; i < body.length; i++) {
    const stmt = body[i];

    // find next meaningful statement for next-step prediction
    let nextStmt: any = null;
    for (let j = i + 1; j < body.length; j++) {
      const candidate = body[j];
      if (
        candidate &&
        candidate.type !== "EmptyStatement" &&
        candidate.type !== "DebuggerStatement"
      ) {
        nextStmt = candidate;
        break;
      }
    }

    const statementCtx: EvalContext = {
      ...ctx,
      nextStatement: nextStmt,
    };

    result = evaluateStatement(stmt, statementCtx);

    // propagate break/continue/return/throw up for loop/function handling
    if (
      isReturnSignal(result) ||
      isBreakSignal(result) ||
      isContinueSignal(result) ||
      isThrowSignal(result)
    ) {
      return result;
    }
  }

  return result;
}

// ---------- STATEMENT ROUTER ----------
export function evaluateStatement(
  node: any,
  ctx: EvalContext
): any {
  if (!node) return;

  const skip = new Set(["WhileStatement", "ForStatement"]);

  // --- 1. LOG CURRENT STEP FIRST ---
  if (!skip.has(node.type) && node.loc) {
    ctx.logger.log(node.loc.start.line - 1);
    // Placeholder to be overwritten by specific evaluators
    ctx.logger.setNext(null, "..."); 
  }

  // --- 2. THEN EXECUTE STATEMENT ---
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
      return;
  }

  // --- 3. RETURN SIGNAL HANDLING ---
  if (isReturnSignal(result)) return result;

  // --- 4. FALLBACK NEXT-STEP ---
  const next = ctx.logger.peekNext?.();
  if (next && next.message === "...") {
    if (ctx.nextStatement) {
      try {
        ctx.logger.setNext(
          ctx.nextStatement.loc.start.line - 1,
          `Next Step → ${displayHeader(
            ctx.nextStatement,
            ctx.logger.getCode()
          )}`
        );
      } catch {
        // ignore formatting errors
        ctx.logger.setNext(null, "Next step (unknown)");
      }
    } else {
      ctx.logger.setNext(null, "End of block");
    }
  }

  return result;
}

// Re-export from expressions for other modules
export { evaluateExpression } from "./expressions";

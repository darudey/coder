// src/engine/statements/evalFor.ts

import type { EvalContext } from "../types";
import { evaluateStatement, evaluateBlockBody } from "../evaluator";
import { evaluateExpression } from "../expressions";
import {
  safeEvaluate,
  getFirstMeaningfulStatement,
  displayHeader,
} from "../next-step-helpers";
import {
  isBreakSignal,
  isContinueSignal,
  isReturnSignal,
  isThrowSignal,
} from "../signals";
import { evalVariableDeclaration } from "./evalDeclarations";

/**
 * for (init; test; update) body
 *
 * Stepping rules:
 *  1. INIT is executed once (no special step, it's just normal code).
 *  2. CONDITION is always its own step (logged here).
 *  3. BODY is stepped statement-by-statement via evaluateStatement / evaluateBlockBody.
 *  4. UPDATE is always its own step (logged here).
 *  5. Next-step predictions:
 *      - after condition TRUE → first statement of body
 *      - after condition FALSE → statement after the loop
 *      - after UPDATE → condition
 */
export function evalForStatement(node: any, ctx: EvalContext): any {
  const loopEnv = ctx.env.extend("block");
  const loopCtx: EvalContext = {
    ...ctx,
    env: loopEnv,
    currentLoop: "for",
  };

  // -----------------------------
  // 1. INIT
  // -----------------------------
  if (node.init) {
    ctx.logger.setCurrentEnv(loopEnv);
    ctx.logger.addFlow("FOR LOOP INIT:");

    if (node.init.type === "VariableDeclaration") {
      evalVariableDeclaration(node.init, loopCtx);
    } else {
      // Expressions like: for (i = 0; i < 3; i++)
      evaluateExpression(node.init, loopCtx);
    }
  }

  let iteration = 0;
  let result: any;

  // -----------------------------
  // 2–5. LOOP
  // -----------------------------
  while (true) {
    iteration++;
    ctx.logger.setCurrentEnv(loopEnv);

    // 2. CONDITION CHECK (its own step)
    if (node.test) {
      // This is an expression, not a statement → we log it manually.
      ctx.logger.log(node.test.loc.start.line - 1);

      const test = safeEvaluate(node.test, loopCtx);
      ctx.logger.addExpressionEval(node.test, test);
      ctx.logger.addExpressionContext(node.test, "For Loop Condition");

      ctx.logger.addFlow(`FOR LOOP CHECK (iteration #${iteration})`);
      ctx.logger.addFlow(
        test
          ? "Result: TRUE → enter loop body"
          : "Result: FALSE → exit loop"
      );

      if (!test) {
        // leaving the loop: next is whatever follows the for-statement
        ctx.logger.setNext(
          node.loc.end.line,
          `Exit FOR loop → ${
            ctx.nextStatement
              ? displayHeader(ctx.nextStatement, ctx.logger.getCode())
              : "End"
          }`
        );
        break;
      }
    }

    // 3. NEXT-STEP HINT → first statement *inside* the body
    const firstBodyStmt =
      node.body.type === "BlockStatement"
        ? getFirstMeaningfulStatement(node.body)
        : node.body;

    if (firstBodyStmt) {
      ctx.logger.setNext(
        firstBodyStmt.loc.start.line - 1,
        `Next Step → ${displayHeader(
          firstBodyStmt,
          ctx.logger.getCode()
        )}`
      );
    }

    // 4. EXECUTE BODY
    //    IMPORTANT: we DO NOT log steps here.
    //    All steps for statements inside the body come from:
    //      - evaluateBlockBody  → evaluateStatement
    //      - and logIfRealStatement in the central evaluator
    let res: any;
    if (node.body.type === "BlockStatement") {
      res = evaluateBlockBody(node.body.body, loopCtx);
    } else {
      res = evaluateStatement(node.body, loopCtx);
    }

    // Handle control signals from the body
    // ----------------- BREAK -----------------
    if (isBreakSignal(res)) {
      if (!res.label) {
        ctx.logger.setNext(
          node.loc.end.line,
          `Break → exit FOR loop. Next: ${
            ctx.nextStatement
              ? displayHeader(ctx.nextStatement, ctx.logger.getCode())
              : "End"
          }`
        );
        break;
      }
      // labelled break → bubble up; outer labelled statement will consume it
      return res;
    }

    // ----------------- CONTINUE -----------------
    if (isContinueSignal(res)) {
      // labelled continue that does NOT target this loop → bubble up
      if (res.label && (!ctx.labels || !ctx.labels[res.label])) {
        return res;
      }
      // otherwise: fall through to UPDATE
    }

    // ----------------- RETURN / THROW -----------------
    if (isReturnSignal(res) || isThrowSignal(res)) {
      result = res;
      break;
    }

    // 5. UPDATE (its own step)
    if (node.update) {
      // First: next-step → this exact update expression
      ctx.logger.setNext(
        node.update.loc.start.line - 1,
        `Next Step → ${displayHeader(
          node.update,
          ctx.logger.getCode()
        )}`
      );

      // Log the UPDATE as a real step
      ctx.logger.log(node.update.loc.start.line - 1);
      ctx.logger.addFlow("FOR LOOP UPDATE:");

      evaluateExpression(node.update, loopCtx);

      // After update runs, next-step is always the condition check again
      if (node.test) {
        ctx.logger.setNext(
          node.test.loc.start.line - 1,
          "Go to loop condition check"
        );
      }
    } else if (node.test) {
      // no update clause: still show that we go back to the condition
      ctx.logger.setNext(
        node.test.loc.start.line - 1,
        "Next Step → evaluate for condition again"
      );
    }
  }

  ctx.logger.setCurrentEnv(ctx.env);
  return result;
}

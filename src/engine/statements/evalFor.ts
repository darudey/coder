
// src/engine/statements/evalFor.ts

import type { EvalContext } from "../types";
import { evaluateStatement, evaluateBlockBody } from "../evaluator";
import { evaluateExpression } from '../expressions';
import { safeEvaluate, getFirstMeaningfulStatement, displayHeader } from "../next-step-helpers";
import { isBreakSignal, isContinueSignal, isReturnSignal, isThrowSignal } from "../signals";
import { evalVariableDeclaration } from "./evalDeclarations";

export function evalForStatement(node: any, ctx: EvalContext): any {
  const loopEnv = ctx.env.extend("block");
  const loopCtx: EvalContext = { ...ctx, env: loopEnv, currentLoop: 'for' };

  // ------------------------------------
  // 1. INIT
  // ------------------------------------
  if (node.init) {
    ctx.logger.setCurrentEnv(loopEnv);
    ctx.logger.addFlow("FOR LOOP INIT:");

    if (node.init.type === "VariableDeclaration") {
      evalVariableDeclaration(node.init, loopCtx);
    } else {
      evaluateExpression(node.init, loopCtx);
    }
  }

  let iteration = 0;
  let result: any;

  while (true) {
    iteration++;
    ctx.logger.setCurrentEnv(loopEnv);

    // ------------------------------------
    // 2. CONDITION CHECK
    // ------------------------------------
    if (node.test) {
      const test = safeEvaluate(node.test, loopCtx);
      ctx.logger.addExpressionEval(node.test, test);
      ctx.logger.addExpressionContext(node.test, "For Loop Condition");

      ctx.logger.addFlow(`FOR LOOP CHECK (iteration #${iteration})`);
      ctx.logger.addFlow(test ? "Result: TRUE → enter loop body" : "Result: FALSE → exit loop");

      if (!test) {
        ctx.logger.setNext(
          node.loc.end.line,
          `Exit FOR loop → ${ctx.nextStatement ?
            displayHeader(ctx.nextStatement, ctx.logger.getCode()) :
            "End"}`
        );
        break;
      }
    }

    // ------------------------------------
    // 3. NEXT STEP → first statement of body
    // ------------------------------------
    const firstBodyStmt =
      node.body.type === "BlockStatement"
        ? getFirstMeaningfulStatement(node.body)
        : node.body;

    if (firstBodyStmt) {
      ctx.logger.setNext(
        firstBodyStmt.loc.start.line - 1,
        `Next Step → ${displayHeader(firstBodyStmt, ctx.logger.getCode())}`
      );
    }

    // ------------------------------------
    // 4. EXECUTE BODY
    // ------------------------------------
    let res: any;
    if (node.body.type === "BlockStatement") {
      res = evaluateBlockBody(node.body.body, loopCtx);
    } else {
      res = evaluateStatement(node.body, loopCtx);
    }

    // BREAK
    if (isBreakSignal(res)) {
      if (!res.label) {
        ctx.logger.setNext(
          node.loc.end.line,
          `Break → exit FOR loop. Next: ${
            ctx.nextStatement ?
              displayHeader(ctx.nextStatement, ctx.logger.getCode()) :
              "End"
          }`
        );
        break;
      }
      return res; // labelled break
    }

    // CONTINUE
    if (isContinueSignal(res)) {
      // label mismatch -> propagate up
      if (res.label && (!ctx.labels || !ctx.labels[res.label])) {
        return res;
      }
      // else: continue to update step
    }

    if (isReturnSignal(res) || isThrowSignal(res)) {
      result = res;
      break;
    }

    // ------------------------------------
    // 5. UPDATE
    // ------------------------------------
    if (node.update) {
      ctx.logger.addFlow("FOR LOOP UPDATE:");
      
      // ⭐ LOG UPDATE *AS ITS OWN STEP*
      ctx.logger.log(node.update.loc.start.line - 1);
      
      ctx.logger.setNext(
        node.update.loc.start.line - 1,
        `Next Step → ${displayHeader(node.update, ctx.logger.getCode())}`
      );

      evaluateExpression(node.update, loopCtx);

      // ⭐ Then set next-step to condition
      if (node.test) {
        ctx.logger.setNext(
            node.test.loc.start.line - 1,
            "Go to loop condition check"
        );
      }
    } else if (node.test) {
        ctx.logger.setNext(
            node.test.loc.start.line - 1,
            "Next Step → evaluate for condition again"
        );
    }
  }

  ctx.logger.setCurrentEnv(ctx.env);
  return result;
}

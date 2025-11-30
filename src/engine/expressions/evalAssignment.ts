// src/engine/expressions/evalAssignment.ts
import type { EvalContext } from "../types";
import { evaluateExpression } from "../evaluator";
import { assignPattern } from "../patterns/evalDestructuring";
import { makeLogicalAssignmentTarget } from "./evalLogical";

export function evalAssignment(node: any, ctx: EvalContext): any {

  // -----------------------------------------
  //  LOGICAL ASSIGNMENTS (&&= ||= ??=)
  // -----------------------------------------
  if (
    node.operator === "&&=" ||
    node.operator === "||=" ||
    node.operator === "??"
  ) {
    const target = makeLogicalAssignmentTarget(node.left, ctx);
    const desc = target.describe;

    const current = target.get();
    ctx.logger.addFlow(`Logical assignment: ${desc} ${node.operator} <rhs>`);
    ctx.logger.addFlow(`Current value → ${JSON.stringify(current)}`);

    let shouldAssign = false;

    if (node.operator === "&&=") {
      const truthy = !!current;
      ctx.logger.addFlow(
        truthy
          ? `${desc} is truthy → evaluate RHS`
          : `${desc} is falsy → skip RHS`
      );
      shouldAssign = truthy;
    } else if (node.operator === "||=") {
      const truthy = !!current;
      ctx.logger.addFlow(
        truthy
          ? `${desc} is truthy → skip RHS`
          : `${desc} is falsy → evaluate RHS`
      );
      shouldAssign = !truthy;
    } else {
      const nullish = current === null || current === undefined;
      ctx.logger.addFlow(
        nullish
          ? `${desc} is nullish → evaluate RHS`
          : `${desc} is NOT nullish → skip RHS`
      );
      shouldAssign = nullish;
    }

    if (!shouldAssign) return current;

    const rhs = evaluateExpression(node.right, ctx);
    ctx.logger.addFlow(`RHS evaluated → ${JSON.stringify(rhs)}`);

    target.set(rhs);
    ctx.logger.addFlow(`Assigned ${desc} = ${JSON.stringify(rhs)}`);

    return rhs;
  }

  // -----------------------------------------
  //  NORMAL ASSIGNMENTS (=, +=, -=, etc.)
  // -----------------------------------------

  // 1️⃣ Extract LHS variable name if simple identifier
  let lhsName: string | null = null;

  if (node.left.type === "Identifier") {
    lhsName = node.left.name;
  }

  // 2️⃣ Capture OLD VALUE before applying assignment
  let oldValue: any = undefined;
  if (lhsName !== null) {
    try {
      oldValue = ctx.env.get(lhsName);
    } catch {
      oldValue = undefined; // uninitialized
    }
  }

  // 3️⃣ Evaluate RHS EXPRESSION
  const rhsValue = evaluateExpression(node.right, ctx);

  // 4️⃣ Compute NEW VALUE based on operator
  let newValue: any = rhsValue;

  if (lhsName !== null) {
    switch (node.operator) {
      case "=":
        newValue = rhsValue;
        break;
      case "+=":
        newValue = oldValue + rhsValue;
        break;
      case "-=":
        newValue = oldValue - rhsValue;
        break;
      case "*=":
        newValue = oldValue * rhsValue;
        break;
      case "/=":
        newValue = oldValue / rhsValue;
        break;
      case "%=":
        newValue = oldValue % rhsValue;
        break;
      default:
        // Other operators unsupported
        newValue = rhsValue;
    }
  }

  // 5️⃣ Now perform the actual assignment
  if (
    node.left.type === "Identifier" ||
    node.left.type === "MemberExpression" ||
    node.left.type === "ObjectPattern" ||
    node.left.type === "ArrayPattern"
  ) {
    assignPattern(node.left, newValue, ctx);
  } else {
    throw new Error("Unsupported assignment target");
  }

  // 6️⃣ Generate detailed breakdown for ExpressionStatement
  const breakdown: string[] = [];

  if (lhsName !== null) {
    breakdown.push(`Assignment (${node.operator}):`);
    breakdown.push(`Left "${lhsName}" old value → ${JSON.stringify(oldValue)}`);
    breakdown.push(`Right side value → ${JSON.stringify(rhsValue)}`);
    breakdown.push(`Computed new value → ${JSON.stringify(newValue)}`);
  } else {
    breakdown.push("Complex assignment target (pattern)");
    breakdown.push(`RHS value → ${JSON.stringify(rhsValue)}`);
  }

  // Attach breakdown to logger
  ctx.logger.addExpressionEval(node, newValue, breakdown);

  return newValue;
}

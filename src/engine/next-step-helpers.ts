// src/engine/next-step-helpers.ts

import type { EvalContext } from "./types";
import { evaluateExpression } from "./expressions";

// ---- AST snippet helpers ----
export function getFirstMeaningfulStatement(block: any): any | null {
  if (!block || block.type !== "BlockStatement") return null;
  for (const stmt of block.body) {
    if (!stmt) continue;
    if (stmt.type !== "EmptyStatement" && stmt.type !== "DebuggerStatement") {
      return stmt;
    }
  }
  return null;
}

export function firstLineOf(node: any, code: string): string {
  if (!node || !node.range) return "";
  let s = code.substring(node.range[0], node.range[1]).trim();
  if (s.length > 80) s = s.slice(0, 77) + "...";
  return s;
}

export function displayHeader(node: any, code: string): string {
  if (!node) return "";

  switch (node.type) {
    case "WhileStatement":
      return `while (${code.substring(node.test.range[0], node.test.range[1])})`;

    case "ForStatement": {
      const endRange = node.body.range[0];
      return code.substring(node.range[0], endRange).trim();
    }

    case "IfStatement":
      return `if (${code.substring(node.test.range[0], node.test.range[1])})`;

    case "ExpressionStatement":
      return code.substring(node.expression.range[0], node.expression.range[1]);

    case "VariableDeclaration":
      return code.substring(node.range[0], node.range[1]).split("\n")[0];

    default:
      return firstLineOf(node, code);
  }
}

// ---- logging helper for “real statements” ----
export function logIfRealStatement(node: any, ctx: EvalContext) {
  const validStatements = new Set([
    "VariableDeclaration",
    "ExpressionStatement",
    "IfStatement",
    "ForStatement",
    "WhileStatement",
    "ReturnStatement",
    "BlockStatement",
    "FunctionDeclaration",
    "ClassDeclaration",
    "BreakStatement",
    "ContinueStatement",
    "SwitchStatement",
    "TryStatement",
    "ThrowStatement",
    "LabeledStatement",
    "ForInStatement",
    "ForOfStatement"
  ]);

  if (node && node.loc && validStatements.has(node.type)) {
    ctx.logger.log(node.loc.start.line - 1);
  }
}

// ---- safeEvaluate wrapper used for conditions ----
export function safeEvaluate(node: any, ctx: EvalContext) {
  return evaluateExpression(node, { ...ctx, safe: true });
}

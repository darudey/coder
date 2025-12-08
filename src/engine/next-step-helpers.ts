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

/**
 * 🔥 FIXED:
 * BlockStatement should NEVER be displayed directly.
 * Instead, we return the header of its FIRST real statement.
 */
export function displayHeader(node: any, code: string): string {
  if (!node) return "";

  // NEW: handle block properly
  if (node.type === "BlockStatement") {
    const first = getFirstMeaningfulStatement(node);
    if (first) return displayHeader(first, code);
    return "{}";
  }

  switch (node.type) {
    case "IfStatement": {
      // only show: if (condition)
      const testCode = code.substring(node.test.range[0], node.test.range[1]);
      return `if (${testCode})`;
    }

    case "WhileStatement": {
      const test = code.substring(node.test.range[0], node.test.range[1]);
      return `while (${test})`;
    }

    case "ForStatement": {
      // show: for (...)
      const header = code.substring(node.range[0], node.body.range[0]).trim();
      return header.replace(/\s*\{$/, ""); // remove trailing brace
    }

    case "FunctionDeclaration": {
      const name = node.id?.name || "(anonymous)";
      const params = node.params.map((p: any) => p.name).join(", ");
      return `function ${name}(${params})`;
    }

    case "ExpressionStatement": {
      return code.substring(node.expression.range[0], node.expression.range[1]);
    }

    case "VariableDeclaration": {
      let line = code.substring(node.range[0], node.range[1]).split("\n")[0];
      return line.replace(/\s*\{$/, "");
    }

    default: {
      // safe fallback: ONLY first line of the snippet
      let s = code.substring(node.range[0], node.range[1]).trim();
      const firstLine = s.split("\n")[0];
      // REMOVE trailing '{' to stop multi-line preview duplication
      return firstLine.replace(/\s*\{$/, "");
    }
  }
}

// ---- logging helper for “real statements” ----
export function logIfRealStatement(node: any, ctx: EvalContext) {
  // Loops are logged internally, so we exclude them here to prevent duplicates.
  const validStatements = new Set([
    "VariableDeclaration",
    "ExpressionStatement",
    "IfStatement",
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
  ]);

  if (node && node.loc && validStatements.has(node.type)) {
    ctx.logger.log(node.loc.start.line - 1);
  }
}

// ---- safeEvaluate wrapper used for conditions ----
export function safeEvaluate(node: any, ctx: EvalContext) {
  // We call the real evaluator, but with a "safe" flag.
  // The expression evaluator then knows not to execute side-effects.
  return evaluateExpression(node, { ...ctx, safe: true });
}

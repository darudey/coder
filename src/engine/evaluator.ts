// src/engine/evaluator.ts

import type { LexicalEnvironment } from "./environment";
import { TimelineLogger } from "./timeline";

export interface EvalContext {
  env: LexicalEnvironment;
  thisValue: any;
  logger: TimelineLogger;
  stack: string[];
}

// A special object to signal a return statement has been executed.
interface ReturnSignal {
  __type: "Return";
  value: any;
}

function makeReturn(value: any): ReturnSignal {
  return { __type: "Return", value };
}

function isReturnSignal(val: any): val is ReturnSignal {
  return val && val.__type === "Return";
}

/**
 * Scans the top-level of a program or function body for declarations
 * that need to be "hoisted" before execution begins.
 */
export function hoistProgram(ast: any, env: LexicalEnvironment) {
  // Simple hoisting: function declarations + var + class
  for (const node of ast.body ?? []) {
    if (node.type === "FunctionDeclaration") {
      const rec = env.record;
      if (!rec.hasBinding?.(node.id.name)) {
        rec.createMutableBinding(node.id.name, "function", undefined, true);
      }
    } else if (node.type === "VariableDeclaration" && node.kind === "var") {
      for (const decl of node.declarations) {
        const name = decl.id.name;
        if (!env.record.hasBinding(name)) {
          env.record.createMutableBinding(name, "var", undefined, true);
        }
      }
    } else if (node.type === "ClassDeclaration") {
      if (!env.record.hasBinding(node.id.name)) {
        env.record.createMutableBinding(node.id.name, "class", undefined, false);
      }
    }
  }
}

/**
 * Logs the current execution state to the timeline.
 */
function logNode(node: any, ctx: EvalContext) {
  if (node && node.loc) {
    ctx.logger.log(node.loc.start.line - 1);
  }
}

/**
 * The main entry point for evaluating a program's AST.
 */
export function evaluateProgram(ast: any, ctx: EvalContext): any {
  hoistProgram(ast, ctx.env);
  return evaluateBlockBody(ast.body, ctx);
}

/**
 * Evaluates an array of statements within a block.
 */
function evaluateBlockBody(body: any[], ctx: EvalContext): any {
  let result: any;
  for (const stmt of body) {
    result = evaluateStatement(stmt, ctx);
    // If a return statement is executed, stop and propagate the signal up.
    if (isReturnSignal(result)) {
      return result;
    }
  }
  return result;
}

/**
 * Evaluates a single statement node from the AST.
 */
function evaluateStatement(node: any, ctx: EvalContext): any {
  if (!node) return;

  logNode(node, ctx);

  switch (node.type) {
    case "VariableDeclaration":
      return evalVariableDeclaration(node, ctx);
    case "ExpressionStatement":
      return evaluateExpression(node.expression, ctx);
    // Other statement types will be added in subsequent steps.
    default:
      return;
  }
}

/**
 * Handles the declaration of variables (var, let, const).
 */
function evalVariableDeclaration(node: any, ctx: EvalContext) {
    const kind: "var" | "let" | "const" = node.kind;
    for (const decl of node.declarations) {
        const name = decl.id.name;
        const value = decl.init ? evaluateExpression(decl.init, ctx) : undefined;
        
        if (kind === "var") {
            // 'var' is hoisted, so we just set its value.
            ctx.env.set(name, value);
        } else {
            // 'let' and 'const' are block-scoped and not hoisted in the same way.
            ctx.env.record.createMutableBinding(name, kind, value, true);
        }
    }
}


/**
 * Evaluates a single expression node from the AST and returns its value.
 */
function evaluateExpression(node: any, ctx: EvalContext): any {
  if (!node) return;

  logNode(node, ctx);

  switch (node.type) {
    case "Identifier":
      return ctx.env.get(node.name);
    case "Literal":
      return node.value;
    // Other expression types will be added in subsequent steps.
    default:
      return undefined;
  }
}

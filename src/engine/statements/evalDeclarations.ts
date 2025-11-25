
// src/engine/statements/evalDeclarations.ts
import { bindPattern } from '../patterns/evalDestructuring';
import { createClassConstructor } from './evalClass';
import type { EvalContext } from '../types';
import { evaluateExpression } from '../expressions';
import { createFunction } from '../values';

export function evalVariableDeclaration(node: any, ctx: EvalContext) {
  const kind: "var" | "let" | "const" = node.kind;
  for (const decl of node.declarations) {
    const pattern = decl.id;
    const value = decl.init ? evaluateExpression(decl.init, ctx) : undefined;
    bindPattern(pattern, value, ctx, kind);
  }
}

export function evalFunctionDeclaration(node: any, ctx: EvalContext) {
  const name = node.id.name;
  const fn = createFunction(node, ctx.env);
  ctx.env.record.initializeBinding(name, fn);
}

export function evalClassDeclaration(node: any, ctx: EvalContext) {
  const name = node.id.name;
  const cls = createClassConstructor(node, ctx);
  ctx.env.record.initializeBinding(name, cls);
}

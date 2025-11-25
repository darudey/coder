
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
    const initValue = decl.init
      ? evaluateExpression(decl.init, ctx)
      : undefined;

    if (pattern.type === "Identifier") {
      // simple
      if (kind === "var") ctx.env.set(pattern.name, initValue);
      else ctx.env.record.createMutableBinding(pattern.name, kind, initValue, true);
      continue;
    }

    // destructuring
     if (pattern.type !== "Identifier") {
        ctx.logger.setNext(
            pattern.loc.start.line - 1,
            `Next Step → destructure: ${ctx.logger.getCode().slice(pattern.range[0], pattern.range[1])}`
        );
    }
    bindPattern(pattern, initValue, ctx, kind);
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

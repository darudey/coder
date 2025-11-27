// src/engine/statements/evalDeclarations.ts
import { bindPattern } from '../patterns/evalDestructuring';
import type { EvalContext } from '../types';
import { evaluateExpression } from '../expressions';
import { createClassConstructor } from './evalClass';

export function evalVariableDeclaration(node: any, ctx: EvalContext) {
  const kind: "var" | "let" | "const" = node.kind;
  ctx.logger.addFlow(`Running ${kind} declaration`);

  for (const decl of node.declarations) {
    const pattern = decl.id;

    let initValue: any = undefined;

    if (decl.init) {
      // 🔹 Log what we are evaluating on this step
      const initCode = ctx.logger
        .getCode()
        .slice(decl.init.range[0], decl.init.range[1]);

      if (pattern.type === "Identifier") {
        ctx.logger.addFlow(
          `Initializing ${kind} ${pattern.name} with ${initCode}`
        );
      } else {
        ctx.logger.addFlow(
          `Initializing ${kind} destructuring pattern with ${initCode}`
        );
      }

      // 🔹 Actually evaluate initializer
      initValue = evaluateExpression(decl.init, ctx);

      // 🔹 Attach expression breakdown to this same step
      ctx.logger.addExpressionEval(decl.init, initValue);
      ctx.logger.addExpressionContext(decl.init, "Variable initializer");
      ctx.logger.addFlow(
        `Initializer result → ${JSON.stringify(initValue)}`
      );
    }

    // Simple identifier case
    if (pattern.type === "Identifier") {
      if (kind === "var") {
        ctx.env.set(pattern.name, initValue);
      } else {
        ctx.env.record.createMutableBinding(
          pattern.name,
          kind,
          initValue,
          true
        );
      }
      continue;
    }

    // Destructuring pattern case
    if (pattern.type !== "Identifier" && pattern.loc && pattern.range) {
      ctx.logger.setNext(
        pattern.loc.start.line - 1,
        `Next Step → destructure: ${ctx.logger
          .getCode()
          .slice(pattern.range[0], pattern.range[1])}`
      );
    }

    bindPattern(pattern, initValue, ctx, kind);
  }
}

export function evalClassDeclaration(node: any, ctx: EvalContext) {
  const name = node.id.name;
  const cls = createClassConstructor(node, ctx);
  ctx.env.record.initializeBinding(name, cls);
}

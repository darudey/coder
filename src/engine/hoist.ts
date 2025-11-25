// src/engine/hoist.ts
import type { LexicalEnvironment } from './environment';

export function hoistProgram(ast: any, env: LexicalEnvironment) {
  for (const node of ast.body ?? []) {
    if (node.type === "FunctionDeclaration") {
      const rec = env.record;
      if (node.id && !rec.hasBinding?.(node.id.name)) {
        rec.createMutableBinding(node.id.name, "function", undefined, false);
      }
    } else if (node.type === "VariableDeclaration" && node.kind === "var") {
      for (const decl of node.declarations) {
        if(decl.id.type === 'Identifier') {
            const name = decl.id.name;
            if (!env.record.hasBinding(name)) {
              env.record.createMutableBinding(name, "var", undefined, true);
            }
        }
      }
    } else if (node.type === "ClassDeclaration") {
      if (node.id && !env.record.hasBinding(node.id.name)) {
        env.record.createMutableBinding(node.id.name, "class", undefined, false);
      }
    }
  }
}

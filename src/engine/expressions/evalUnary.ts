// src/engine/expressions/evalUnary.ts
import type { EvalContext } from '../types';
import { evaluateExpression } from '../evaluator';
import { evalMemberTarget } from './evalMember';

export function evalUnary(node: any, ctx: EvalContext): any {
    const arg = evaluateExpression(node.argument, ctx);
    switch (node.operator) {
      case "!": return !arg;
      case "+": return +arg;
      case "-": return -arg;
      case "typeof":
        if (node.argument.type === "Identifier" && !ctx.env.hasBinding(node.argument.name)) {
          return "undefined";
        }
        return typeof arg;
      case "void": return void arg;
      case "delete":
        if (node.argument.type === "MemberExpression") {
          const { object, property } = evalMemberTarget(node.argument, ctx);
          return delete (object as any)[property];
        }
        return false;
      default:
        throw new Error(`Unsupported unary operator: ${node.operator}`);
    }
}

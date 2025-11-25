// src/engine/expressions/evalBinary.ts
import type { EvalContext } from '../types';
import { evaluateExpression } from '../evaluator';

export function evalBinary(node: any, ctx: EvalContext): any {
    const left = evaluateExpression(node.left, ctx);
    const right = evaluateExpression(node.right, ctx);
    switch (node.operator) {
        case "+": return left + right;
        case "-": return left - right;
        case "*": return left * right;
        case "/": return left / right;
        case "%": return left % right;
        case "===": return left === right;
        case "!==": return left !== right;
        case "==": return left == right;
        case "!=": return left != right;
        case ">": return left > right;
        case "<": return left < right;
        case ">=": return left >= right;
        case "<=": return left <= right;
        case "in": return left in right;
        case "instanceof": return left instanceof right;
        default:
          throw new Error(`Unsupported binary operator: ${node.operator}`);
    }
}

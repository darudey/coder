
// src/engine/expressions/evalAssignment.ts
import type { EvalContext } from '../types';
import { evaluateExpression } from '../evaluator';
import { assignPattern } from '../patterns/evalDestructuring';
import { makeLogicalAssignmentTarget } from "./evalLogical";

export function evalAssignment(node: any, ctx: EvalContext): any {
    if (
      node.operator === "&&=" ||
      node.operator === "||=" ||
      node.operator === "??="
    ) {
      const target = makeLogicalAssignmentTarget(node.left, ctx);
      const desc = target.describe;
    
      const current = target.get();
      ctx.logger.addFlow(`Logical assignment: ${desc} ${node.operator} <rhs>`);
      ctx.logger.addFlow(`Current value of ${desc} is ${JSON.stringify(current)}`);
    
      let shouldAssign = false;
    
      if (node.operator === "&&=") {
        const truthy = !!current;
        ctx.logger.addFlow(
          truthy
            ? `${desc} is truthy → will evaluate RHS and assign`
            : `${desc} is falsy → skip RHS`
        );
        shouldAssign = truthy;
      } else if (node.operator === "||=") {
        const truthy = !!current;
        ctx.logger.addFlow(
          truthy
            ? `${desc} is truthy → skip RHS`
            : `${desc} is falsy → will evaluate RHS and assign`
        );
        shouldAssign = !truthy;
      } else {
        const nullish = current === null || current === undefined;
        ctx.logger.addFlow(
          nullish
            ? `${desc} is nullish → evaluating RHS`
            : `${desc} NOT nullish → skip RHS`
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

    const value = evaluateExpression(node.right, ctx);

    if (
      node.left.type === "Identifier" ||
      node.left.type === "MemberExpression" ||
      node.left.type === "ObjectPattern" ||
      node.left.type === "ArrayPattern"
    ) {
      assignPattern(node.left, value, ctx);
      return value;
    }
  
    throw new Error("Unsupported assignment target");
}

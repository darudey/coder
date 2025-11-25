// src/engine/expressions/evalNew.ts
import type { EvalContext } from '../types';
import { evaluateExpression } from '../evaluator';
import { createObject } from '../values';

export function evalNew(node: any, ctx: EvalContext): any {
    const ctor = evaluateExpression(node.callee, ctx);
    const args = node.arguments.map((arg: any) => evaluateExpression(arg, ctx));
  
    if (ctor && typeof (ctor as any).construct === "function") {
      return (ctor as any).construct(args);
    }
  
    if (typeof ctor === "function") {
      const instance = createObject((ctor as any).prototype || Object.prototype);
      const res = ctor.apply(instance, args);
      return res !== null && typeof res === "object" ? res : instance;
    }
  
    throw new Error("new operator used on non-constructible value");
}

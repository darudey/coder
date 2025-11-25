// src/engine/expressions/evalObject.ts
import type { EvalContext } from '../types';
import { evaluateExpression } from '../evaluator';
import { createObject, setProperty } from '../values';

export function evalObject(node: any, ctx: EvalContext): any {
    const obj = createObject(Object.prototype as any);
    for (const prop of node.properties) {
      const key = prop.key.type === "Identifier" ? prop.key.name : evaluateExpression(prop.key, ctx);
      const value = evaluateExpression(prop.value, ctx);
      setProperty(obj, key, value);
    }
    return obj;
}

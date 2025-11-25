// src/engine/expressions/evalMember.ts
import type { EvalContext } from '../types';
import { evaluateExpression } from '../evaluator';
import { getProperty } from '../values';

export function evalMember(node: any, ctx: EvalContext): any {
    const { object, property } = evalMemberTarget(node, ctx);
    return getProperty(object, property);
}

export function evalMemberTarget(node: any, ctx: EvalContext) {
    const object = evaluateExpression(node.object, ctx);
    let property: any;
    if (node.computed) {
      property = evaluateExpression(node.property, ctx);
    } else {
      property = node.property.name;
    }
    return { object, property };
}

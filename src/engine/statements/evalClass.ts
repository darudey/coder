// src/engine/statements/evalClass.ts
import type { EvalContext } from '../types';
import { createObject, setProperty, FunctionValue } from '../values';
import { createUserFunction } from './evalDeclarations';
import { isReturnSignal } from '../signals';
import type { TimelineLogger } from '../timeline';


export function createClassConstructor(node: any, ctx: EvalContext): FunctionValue {
    const classBody = node.body;
    const ctorMethod = classBody.body.find((m: any) => m.kind === "constructor");
  
    const baseCtor = createUserFunction(
      ctorMethod ?? ({
        type: "FunctionExpression",
        id: null,
        params: [],
        body: { type: "BlockStatement", body: [] },
      } as any),
      ctx.env
    );
  
    const proto = createObject(Object.prototype as any);
  
    for (const el of classBody.body) {
      if (el.type === "MethodDefinition" && el.kind !== "constructor") {
        const methodName = el.key.name;
        const methodFn = createUserFunction(el.value, ctx.env);
        setProperty(proto, methodName, methodFn);
      }
    }
  
    (baseCtor as any).prototype = proto;
    (baseCtor as any).__isClassConstructor = true;
  
    (baseCtor as any).construct = (args: any[]) => {
      const instance = createObject(proto);
      const fn: any = baseCtor;
      if (!fn.__ctx) fn.__ctx = { logger: ctx.logger, stack: ctx.stack };
  
      const funcName = node.id?.name || "<constructor>";
      ctx.stack.push(funcName);
      const logger = fn.__ctx.logger as TimelineLogger;
      logger.setCurrentEnv(fn.__env);
  
      const result = fn.call(instance, args);
  
      ctx.stack.pop();
      logger.setCurrentEnv(ctx.env);
  
      if (isReturnSignal(result)) {
        if (typeof result.value === "object" && result.value !== null) return result.value;
      }
      return instance;
    };
  
    return baseCtor;
}

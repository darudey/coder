
// src/engine/statements/evalClass.ts

import type { EvalContext } from "../types";
import { createUserFunction, createObject, setProperty, type FunctionValue } from "../values";

function createClassConstructor(node: any, ctx: EvalContext): FunctionValue {
  const className = node.id?.name || 'AnonymousClass';
  
  const constructorDef = node.body.body.find(
    (member: any) => member.kind === 'constructor'
  );

  // If no constructor is provided, create a default one
  const ctorParams = constructorDef?.value.params ?? [];
  const ctorBody = constructorDef?.value.body ?? { type: 'BlockStatement', body: [] };
  
  const methods: { [key: string]: FunctionValue } = {};
  for(const member of node.body.body) {
      if (member.type === 'MethodDefinition' && member.kind !== 'constructor') {
          const methodName = member.key.name;
          methods[methodName] = createUserFunction(member.value, ctx.env);
      }
  }

  const constructorFn = function(this: any, thisArg: any, args: any[]) {
      const instance = thisArg; // `this` is already the new instance
      
      // Add methods to instance
      for(const methodName in methods) {
          setProperty(instance, methodName, methods[methodName]);
      }
      
      // Call the actual constructor logic
      const fn = createUserFunction({ params: ctorParams, body: ctorBody }, ctx.env);
      fn.call(instance, args);

      return instance;
  }

  const classFn = createFunction(
      ctx.env,
      ctorParams,
      ctorBody,
      constructorFn
  );
  
  classFn.__isClassConstructor = true;
  classFn.prototype = createObject(Object.prototype);
  setProperty(classFn.prototype, "constructor", classFn);

  // Add static methods if any
  for(const member of node.body.body) {
    if (member.type === 'MethodDefinition' && member.static) {
      const staticMethodName = member.key.name;
      setProperty(classFn, staticMethodName, createUserFunction(member.value, ctx.env));
    }
  }

  // Handle extends
  if (node.superClass) {
      const superConstructor = ctx.env.get(node.superClass.name);
      if (superConstructor && superConstructor.prototype) {
          Object.setPrototypeOf(classFn.prototype, superConstructor.prototype);
      }
  }

  return classFn;
}

export function evalClassDeclaration(node: any, ctx: EvalContext) {
  const name = node.id.name;
  const cls = createClassConstructor(node, ctx);
  ctx.env.record.initializeBinding(name, cls);
}

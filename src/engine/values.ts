// src/engine/values.ts

import type { LexicalEnvironment } from "./environment";

export interface FunctionValue {
  __isFunctionValue: true;
  __env: LexicalEnvironment;
  __params: any[];
  __body: any;
  __impl: (this: FunctionValue, thisArg: any, args: any[]) => any;
  __ctx?: {
    logger: any;
    stack: string[];
  };
  __node?: any;
  __isClassConstructor?: boolean;

  prototype?: any;
  call(thisArg: any, args: any[]): any;
  construct?: (args: any[]) => any;
}

export function isUserFunction(value: any): value is FunctionValue {
  return !!value && value.__isFunctionValue === true;
}

export function createFunction(
  env: LexicalEnvironment,
  params: any[],
  body: any,
  impl: (this: FunctionValue, thisArg: any, args: any[]) => any
): FunctionValue {

  const fn: FunctionValue = {
    __isFunctionValue: true,
    __env: env,
    __params: params,
    __body: body,
    __impl: impl,

    // Called with:  fn.call(thisArg, argsArray)
    call(thisArg: any, args: any[]) {
      // Inherit the caller's logging context
      if (!this.__ctx) {
        this.__ctx = { logger: undefined!, stack: [] };
      }
      return this.__impl.call(this, thisArg, args);
    },

    // Default constructor → fallback to call()
    construct(args: any[]) {
      return this.call(undefined, args);
    },

    // Standard JS function prototype
    prototype: {},
  };

  // Set constructor on the prototype (true JS behavior)
  Object.defineProperty(fn.prototype, "constructor", {
    value: fn,
    enumerable: false,
    writable: true,
  });

  return fn;
}

export function createObject(proto: any): any {
  return Object.create(proto || Object.prototype);
}

export function setPrototype(obj: any, proto: any) {
  Object.setPrototypeOf(obj, proto);
}

export function getProperty(obj: any, key: any): any {
  if (obj == null) return undefined;
  return obj[key];
}

export function setProperty(obj: any, key: any, value: any) {
  if (obj == null) return;
  obj[key] = value;
}

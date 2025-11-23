
// src/engine/values.ts

import type { LexicalEnvironment } from "./environment";

export interface JSObject {
  [key: string]: any;
  __proto__?: JSObject | null;
}

export interface FunctionValue extends JSObject {
  __isFunctionObject?: boolean;
  __env: LexicalEnvironment;
  __params: any[];
  __body: any; // AST node (FunctionBody / BlockStatement)
  __isClassConstructor?: boolean;
  call: (thisArg: any, args: any[]) => any;
  construct?: (args: any[]) => any;
}

export function createObject(proto: JSObject | null = null): JSObject {
  return { __proto__: proto };
}

export function createFunction(
  env: LexicalEnvironment,
  params: any[],
  body: any,
  impl?: (thisArg: any, args: any[]) => any
): FunctionValue {
  const fn: FunctionValue = {
    __isFunctionObject: true,
    __env: env,
    __params: params,
    __body: body,
    call: impl ?? (() => undefined),
    __proto__: Function.prototype as any
  };
  return fn;
}

export function setPrototype(obj: JSObject, proto: JSObject | null) {
  obj.__proto__ = proto;
}

export function getProperty(obj: any, prop: any): any {
  if (obj == null) return undefined;
  let cur: any = obj;
  while (cur) {
    if (Object.prototype.hasOwnProperty.call(cur, prop)) {
      return cur[prop];
    }
    cur = cur.__proto__;
  }
  return undefined;
}

export function setProperty(obj: any, prop: any, value: any) {
  if (obj == null) throw new Error("Cannot set property on null/undefined");
  obj[prop] = value;
}

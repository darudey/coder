// src/engine/signals.ts

export interface ReturnSignal {
  __type: "Return";
  value: any;
}
export interface BreakSignal {
  __type: "Break";
  label?: string | null;
}
export interface ContinueSignal {
  __type: "Continue";
  label?: string | null;
}
export interface ThrowSignal {
  __type: "Throw";
  value: any;
}

export function makeReturn(value: any): ReturnSignal {
  return { __type: "Return", value };
}
export function makeBreak(label?: string | null): BreakSignal {
  return { __type: "Break", label: label ?? null };
}
export function makeContinue(label?: string | null): ContinueSignal {
  return { __type: "Continue", label: label ?? null };
}
export function makeThrow(value: any): ThrowSignal {
  return { __type: "Throw", value };
}

export function isReturnSignal(v: any): v is ReturnSignal {
  return v && v.__type === "Return";
}
export function isBreakSignal(v: any): v is BreakSignal {
  return v && v.__type === "Break";
}
export function isContinueSignal(v: any): v is ContinueSignal {
  return v && v.__type === "Continue";
}
export function isThrowSignal(v: any): v is ThrowSignal {
  return v && v.__type === "Throw";
}

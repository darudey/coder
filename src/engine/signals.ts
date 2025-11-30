// src/engine/signals.ts

// ----------------------------------------------------
// CONTROL SIGNAL TYPES
// ----------------------------------------------------

export interface BaseSignal {
  __signal: true;
  __type: "Return" | "Break" | "Continue" | "Throw";
}

export interface ReturnSignal extends BaseSignal {
  __type: "Return";
  value: any;
}

export interface BreakSignal extends BaseSignal {
  __type: "Break";
  label: string | null;
}

export interface ContinueSignal extends BaseSignal {
  __type: "Continue";
  label: string | null;
}

export interface ThrowSignal extends BaseSignal {
  __type: "Throw";
  value: any;
}

// ----------------------------------------------------
// FACTORY HELPERS — IMMUTABLE SIGNAL OBJECTS
// ----------------------------------------------------

export function makeReturn(value: any): ReturnSignal {
  return Object.freeze({
    __signal: true,
    __type: "Return",
    value,
  });
}

export function makeBreak(label?: string | null): BreakSignal {
  return Object.freeze({
    __signal: true,
    __type: "Break",
    label: label ?? null,
  });
}

export function makeContinue(label?: string | null): ContinueSignal {
  return Object.freeze({
    __signal: true,
    __type: "Continue",
    label: label ?? null,
  });
}

export function makeThrow(value: any): ThrowSignal {
  return Object.freeze({
    __signal: true,
    __type: "Throw",
    value,
  });
}

// ----------------------------------------------------
// TYPE GUARDS
// ----------------------------------------------------

export function isSignal(v: any): v is BaseSignal {
  return v && v.__signal === true;
}

export function isReturnSignal(v: any): v is ReturnSignal {
  return v && v.__signal === true && v.__type === "Return";
}

export function isBreakSignal(v: any): v is BreakSignal {
  return v && v.__signal === true && v.__type === "Break";
}

export function isContinueSignal(v: any): v is ContinueSignal {
  return v && v.__signal === true && v.__type === "Continue";
}

export function isThrowSignal(v: any): v is ThrowSignal {
  return v && v.__signal === true && v.__type === "Throw";
}

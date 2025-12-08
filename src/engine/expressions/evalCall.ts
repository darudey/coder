// src/engine/expressions/evalCall.ts
//
// FINAL PHASE-2 VERSION + metadata for UI
//

import type { EvalContext } from "../types";
import { evaluateExpression } from "../evaluator";
import { isUserFunction, FunctionValue } from "../values";
import { isReturnSignal } from "../signals";
import { evalMemberTarget } from "./evalMember";
import { getFirstMeaningfulStatement, displayHeader } from "../next-step-helpers";

let CALL_COUNTER = 0;
export function resetCallCounter() { CALL_COUNTER = 0; }

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

function safeString(v: any): string {
  try {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (typeof v === "string") return JSON.stringify(v);
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "function") return "[Function]";
    if (v && typeof v === "object" && v.__isFunctionValue) return "[Function]";
    return JSON.stringify(v);
  } catch {
    return "[Object]";
  }
}

function getCalleeName(node: any, value: any): string {
  if (!node) return "<call>";
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression") {
    return node.computed ? "<computed>" : node.property?.name ?? "<member>";
  }
  if (value?.__node?.type === "ArrowFunctionExpression") return "(arrow closure)";
  return "<function>";
}

/**
 * Collect ONLY lexical outer function bindings.
 * Stops at Script/Global to avoid large captures.
 */
export function collectCapturedVariables(fn: FunctionValue): Record<string, any> {
  const result: Record<string, any> = {};
  let env = fn.__env;

  while (env && env.outer && env.outer.kind === "function") {
    const rec = env.outer.record?.bindings;
    if (rec) {
      const names =
        typeof rec.keys === "function" ? [...rec.keys()] : Object.keys(rec);

      for (const name of names) {
        const binding = typeof rec.get === "function" ? rec.get(name) : rec[name];
        const val = binding?.value ?? binding;
        result[name] = safeString(val);
      }
    }
    env = env.outer;
  }
  return result;
}


// Helper to build signature from a function value/node (Option C)
function buildReadableSignatureFromValue(val: any, loggerCode: string) {
  try {
    const node = val.__node;
    if (!node) return undefined;
    if (node.type === "FunctionExpression" || node.type === "FunctionDeclaration") {
      const name = node.id?.name || "(anonymous)";
      const params = (node.params || []).map((p: any) => (p.type === "Identifier" ? p.name : "")).join(", ");
      return `function ${name}(${params})`;
    }
    if (node.type === "ArrowFunctionExpression") {
      if (node.range) {
        try {
          return loggerCode.substring(node.range[0], node.range[1]);
        } catch {}
      }
      const params = (node.params || []).map((p: any) => (p.type === "Identifier" ? p.name : "")).join(", ");
      return `(${params}) => (arrow body)`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// ----------------------------------------------------------------------
// evalCall — HEART OF CALL EXECUTION
// ----------------------------------------------------------------------

export function evalCall(node: any, ctx: EvalContext): any {
  CALL_COUNTER++;
  ctx.logger.addFlow(`── Call #${CALL_COUNTER} start ──`);

  const calleeVal = evaluateExpression(node.callee, ctx);
  const args = node.arguments.map((arg: any) => evaluateExpression(arg, ctx));

  const thisArg =
    node.callee.type === "MemberExpression"
      ? evalMemberTarget(node.callee, ctx).object
      : ctx.thisValue ?? undefined;

  const calleeName = getCalleeName(node.callee, calleeVal);

  ctx.logger.addFlow(
    `Calling function ${calleeName}(${args.map(a => safeString(a)).join(", ")})`
  );

  // Set call metadata (UI)
  try {
    const kind = calleeVal?.__node?.type === "ArrowFunctionExpression" ? "ArrowCall" : "FunctionCall";
    const signature = buildReadableSignatureFromValue(calleeVal, ctx.logger.getCode()) ?? calleeName;
    // use normalized metadata API
    ctx.logger.updateMeta({
      kind,
      functionName: calleeName,
      signature,
      callDepth: (ctx.stack?.length ?? 0) + 1,
      activeScope: ctx.env.name ?? "Unknown",
    });
  } catch {}

  // ------------------------------------------------------------------
  // ✔ Arrow closure entry (teaching-friendly)
  // ------------------------------------------------------------------
  if (calleeVal?.__node?.type === "ArrowFunctionExpression") {
    const params = (calleeVal.__node?.params || []).map((p: any, i: number) =>
        `${p.name} = ${safeString(args[i])}`
    );

    ctx.logger.addFlow(`Entering closure (${params.join(", ")})`);

    // Explain closure only ONCE
    if (!calleeVal.__closureExplained) {
      const captured = Object.entries(collectCapturedVariables(calleeVal))
        .map(([k,v]) => `${k} = ${JSON.stringify(v)}`)
        .join(', ');

      if (captured.length > 0) {
        ctx.logger.addFlow(
          `Closure created. It remembers: ${captured}`
        );
      }
      calleeVal.__closureExplained = true;
    }

    // DO NOT create a new timeline step — expressions.ts handles arrow step creation
    const body = calleeVal.__node.body;
    if (body?.loc) {
      if (body.type === "BlockStatement") {
        const first = getFirstMeaningfulStatement(body);
        if (first?.loc) {
            const ln = first.loc.start.line;
            const lineText = ctx.logger.getCode().split("\n")[ln - 1].trim();
            ctx.logger.setNext(ln - 1, `Next Step → ${lineText} (line ${ln})`);
        }
      } else {
        const ln = body.loc.start.line;
        const lineText = ctx.logger.getCode().split("\n")[ln - 1].trim();
        ctx.logger.setNext(ln - 1, `Next Step → ${lineText} (line ${ln})`);
      }
    }
  }

  // ------------------------------------------------------------------
  // ✔ Next-step prediction for normal functions
  // ------------------------------------------------------------------
  if (calleeVal?.__node && calleeVal.__node.type !== "ArrowFunctionExpression") {
    const body = calleeVal.__node.body;

    const nextHeaderNode =
        body && body.type === "BlockStatement"
            ? getFirstMeaningfulStatement(body)
            : body;

    if (nextHeaderNode?.loc) {
        const ln = nextHeaderNode.loc.start.line;
        const lineText = ctx.logger.getCode().split("\n")[ln - 1].trim();
        ctx.logger.setNext(
            ln - 1,
            `Next Step → ${lineText} (line ${ln})`
        );
    }
  }

  // ------------------------------------------------------------------
  // ✔ Builtin console.log
  // ------------------------------------------------------------------
  if (calleeVal && (calleeVal as any).__builtin === "console.log") {
    const formattedArgs = args.map(a => safeString(a)).join(" ");
    ctx.logger.logOutput(formattedArgs);
    ctx.logger.addFlow(`console.log → ${formattedArgs}`);
    ctx.logger.addFlow(`── Call #${CALL_COUNTER} complete (returned undefined) ──`);
    // also mark metadata for this step (console output) — use normalized API
    ctx.logger.updateMeta({ kind: "ConsoleOutput", outputText: formattedArgs, callDepth: ctx.stack?.length ?? 0 });
    ctx.logger.setNext(null, "Return: control returns to caller");
    return undefined;
  }

  // ------------------------------------------------------------------
  // ✔ Native JS function
  // ------------------------------------------------------------------
  if (typeof calleeVal === "function" && !isUserFunction(calleeVal)) {
    const result = calleeVal.apply(thisArg, args);
    ctx.logger.addFlow(
      `── Call #${CALL_COUNTER} complete (returned ${safeString(result)}) ──`
    );
    // metadata for native function return — normalized API
    ctx.logger.updateMeta({ kind: "Return", returnedValue: safeString(result), callDepth: ctx.stack?.length ?? 0 });
    return result;
  }

  // ------------------------------------------------------------------
  // ✔ User-defined function (function or arrow)
  // ------------------------------------------------------------------
  if (isUserFunction(calleeVal)) {
    const fn = calleeVal as FunctionValue;

    // Provide logger/stack to user function
    if (!fn.__ctx) fn.__ctx = { logger: ctx.logger, stack: ctx.stack };

    const result = fn.call(thisArg, args);

    if (isReturnSignal(result)) {
      ctx.logger.addFlow(
        `── Call #${CALL_COUNTER} complete (returned ${safeString(
          result.value
        )}) ──`
      );
      ctx.logger.updateMeta({ kind: "Return", returnedValue: safeString(result.value), callDepth: ctx.stack?.length ?? 0 });
      return result.value;
    }

    ctx.logger.addFlow(
      `── Call #${CALL_COUNTER} complete (returned ${safeString(result)}) ──`
    );
    ctx.logger.updateMeta({ kind: "Return", returnedValue: safeString(result), callDepth: ctx.stack?.length ?? 0 });
    return result;
  }

  throw new Error(`Call of non-function value (${safeString(calleeVal)})`);
}

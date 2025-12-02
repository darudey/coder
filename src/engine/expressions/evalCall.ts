// src/engine/expressions/evalCall.ts
import type { EvalContext } from '../types';
import { evaluateExpression } from '../evaluator';
import { isUserFunction, FunctionValue } from '../values';
import { isReturnSignal } from '../signals';
import { evalMemberTarget } from './evalMember';
import {
  getFirstMeaningfulStatement,
  displayHeader,
} from '../next-step-helpers';

let CALL_COUNTER = 0;
export function resetCallCounter() {
  CALL_COUNTER = 0;
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------
function safeString(v: any): string {
  try {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v === 'function') return '[Function]';
    if (v && typeof v === 'object' && v.__isFunctionValue) return '[Function]';
    return JSON.stringify(v);
  } catch {
    return '[Object]';
  }
}

function getCalleeName(node: any, value: any): string {
  if (!node) return '<call>';
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression') {
    return node.computed ? '<computed>' : node.property?.name ?? '<member>';
  }
  if (value?.__node?.type === 'ArrowFunctionExpression')
    return '(arrow closure)';
  return '<function>';
}

// Captures only lexical outer variables; stops at Script/Global
function collectCapturedVariables(fn: FunctionValue): string[] {
  const result: string[] = [];
  let env = fn.__env?.outer;

  while (env && env.kind === 'function') {
    const rec = env.record?.bindings;
    if (rec) {
      const names =
        typeof rec.keys === 'function' ? [...rec.keys()] : Object.keys(rec);
      for (const name of names) {
        const binding = typeof rec.get === 'function' ? rec.get(name) : rec[name];
        const val = binding?.value ?? binding;
        result.push(`${name} = ${safeString(val)}`);
      }
    }
    env = env.outer;
  }
  return result;
}

// ----------------------------------------------------------------------
// evalCall
// ----------------------------------------------------------------------
export function evalCall(node: any, ctx: EvalContext): any {
  CALL_COUNTER++;
  ctx.logger.addFlow(`── Call #${CALL_COUNTER} start ──`);

  const calleeVal = evaluateExpression(node.callee, ctx);
  const args = node.arguments.map((arg: any) => evaluateExpression(arg, ctx));

  const thisArg =
    node.callee.type === 'MemberExpression'
      ? evalMemberTarget(node.callee, ctx).object
      : ctx.thisValue ?? undefined;

  const calleeName = getCalleeName(node.callee, calleeVal);
  ctx.logger.addFlow(
    `Calling function ${calleeName}(${args.map(a => safeString(a)).join(', ')})`
  );

  // ------------------------------------------------------------------
  // Arrow Closure entry (teaching-friendly)
  // ------------------------------------------------------------------
  if (calleeVal?.__node?.type === 'ArrowFunctionExpression') {
    const params = calleeVal.__params.map((p: any, i: number) =>
      `${p.name} = ${safeString(args[i])}`
    );

    const captured = collectCapturedVariables(calleeVal);
    ctx.logger.addFlow(`Entering closure (${params.join(', ')})`);

    if (captured.length > 0) {
      ctx.logger.addFlow(
        `Closure created. It remembers: ${captured.join(', ')}`
      );
    }

    // Create a single correct step at arrow body line
    const body = calleeVal.__node.body;
    if (body?.loc) {
      ctx.logger.log(body.loc.start.line - 1);
      ctx.logger.setNext(body.loc.start.line - 1, `Evaluating arrow body`);
    }
  }

  // ------------------------------------------------------------------
  // Next-step prediction for non-arrow functions
  // ------------------------------------------------------------------
  if (calleeVal?.__node && calleeVal.__node.type !== 'ArrowFunctionExpression') {
    const body = calleeVal.__node.body;
    if (body?.loc) {
      const first =
        body.type === 'BlockStatement'
          ? getFirstMeaningfulStatement(body)?.loc?.start.line - 1
          : body.loc.start.line - 1;

      ctx.logger.setNext(
        first,
        `Next Step → ${displayHeader(body, ctx.logger.getCode())}`
      );
    }
  }

  // ------------------------------------------------------------------
  // Native builtin (console.log)
  // ------------------------------------------------------------------
  if (calleeVal && (calleeVal as any).__builtin === 'console.log') {
    const formattedArgs = args.map(a => safeString(a)).join(' ');
    ctx.logger.logOutput(formattedArgs);
    ctx.logger.addFlow(`console.log → ${formattedArgs}`);
    ctx.logger.addFlow(`── Call #${CALL_COUNTER} complete (returned undefined) ──`);
    return undefined;
  }

  // ------------------------------------------------------------------
  // Non-user JS function (native)
  // ------------------------------------------------------------------
  if (typeof calleeVal === 'function' && !isUserFunction(calleeVal)) {
    const result = calleeVal.apply(thisArg, args);
    ctx.logger.addFlow(
      `── Call #${CALL_COUNTER} complete (returned ${safeString(result)}) ──`
    );
    return result;
  }

  // ------------------------------------------------------------------
  // User-defined functions
  // ------------------------------------------------------------------
  if (isUserFunction(calleeVal)) {
    const fn = calleeVal as FunctionValue;
    if (!fn.__ctx) fn.__ctx = { logger: ctx.logger, stack: ctx.stack };

    const result = fn.call(thisArg, args);

    if (isReturnSignal(result)) {
      ctx.logger.addFlow(
        `── Call #${CALL_COUNTER} complete (returned ${safeString(
          result.value
        )}) ──`
      );
      return result.value;
    }

    ctx.logger.addFlow(
      `── Call #${CALL_COUNTER} complete (returned ${safeString(result)}) ──`
    );
    return result;
  }

  throw new Error('Call of non-function value');
}

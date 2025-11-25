// src/engine/evaluator.ts
// Complete evaluator with Next-Step predictor, switch / try-catch / labels support,
// and robust handling of break / continue / return / throw signals.
//
// Depends on:
// - ./environment (LexicalEnvironment, EnvironmentRecord)
// - ./timeline (TimelineLogger)
// - ./values (createFunction, createObject, FunctionValue, getProperty, setProperty, isUserFunction)
// Keep function / type names consistent with your other modules.

import type { LexicalEnvironment } from "./environment";
import { EnvironmentRecord, LexicalEnvironment as LexEnv } from "./environment";
import { TimelineLogger } from "./timeline";
import {
  createFunction,
  createObject,
  FunctionValue,
  getProperty,
  setProperty,
  isUserFunction,
} from "./values";

export interface EvalContext {
  env: LexicalEnvironment;
  thisValue: any;
  logger: TimelineLogger;
  stack: string[];
  safe?: boolean;
  nextStatement?: any; // used for next-step prediction within block sequences
  labels?: Record<string, any>; // labelled targets (for future use / debugging)
}

// ---------- CONTROL SIGNALS ----------
interface ReturnSignal {
  __type: "Return";
  value: any;
}
interface BreakSignal {
  __type: "Break";
  label?: string | null;
}
interface ContinueSignal {
  __type: "Continue";
  label?: string | null;
}
interface ThrowSignal {
  __type: "Throw";
  value: any;
}

function makeReturn(value: any): ReturnSignal {
  return { __type: "Return", value };
}
function makeBreak(label?: string | null): BreakSignal {
  return { __type: "Break", label: label ?? null };
}
function makeContinue(label?: string | null): ContinueSignal {
  return { __type: "Continue", label: label ?? null };
}
function makeThrow(value: any): ThrowSignal {
  return { __type: "Throw", value };
}

function isReturnSignal(v: any): v is ReturnSignal {
  return v && v.__type === "Return";
}
function isBreakSignal(v: any): v is BreakSignal {
  return v && v.__type === "Break";
}
function isContinueSignal(v: any): v is ContinueSignal {
  return v && v.__type === "Continue";
}
function isThrowSignal(v: any): v is ThrowSignal {
  return v && v.__type === "Throw";
}

// ---------- HOISTING ----------
export function hoistProgram(ast: any, env: LexicalEnvironment) {
  for (const node of ast.body ?? []) {
    if (node.type === "FunctionDeclaration") {
      const rec = env.record;
      if (node.id && !rec.hasBinding?.(node.id.name)) {
        rec.createMutableBinding(node.id.name, "function", undefined, false);
      }
    } else if (node.type === "VariableDeclaration" && node.kind === "var") {
      for (const decl of node.declarations) {
        if(decl.id.type === 'Identifier') {
            const name = decl.id.name;
            if (!env.record.hasBinding(name)) {
              env.record.createMutableBinding(name, "var", undefined, true);
            }
        }
      }
    } else if (node.type === "ClassDeclaration") {
      if (node.id && !env.record.hasBinding(node.id.name)) {
        env.record.createMutableBinding(node.id.name, "class", undefined, false);
      }
    }
  }
}

// ---------- MAIN ENTRY ----------
export function evaluateProgram(ast: any, ctx: EvalContext): any {
  hoistProgram(ast, ctx.env);
  return evaluateBlockBody(ast.body, ctx);
}

// ---------- BLOCK EVALUATION (sequential statements) ----------
function evaluateBlockBody(body: any[], ctx: EvalContext): any {
  let result: any;

  for (let i = 0; i < body.length; i++) {
    const stmt = body[i];

    // find next meaningful statement for next-step prediction
    let nextStmt: any = null;
    for (let j = i + 1; j < body.length; j++) {
      const candidate = body[j];
      if (candidate && candidate.type !== "EmptyStatement" && candidate.type !== "DebuggerStatement") {
        nextStmt = candidate;
        break;
      }
    }

    const statementCtx: EvalContext = { ...ctx, nextStatement: nextStmt };

    result = evaluateStatement(stmt, statementCtx);

    // propagate break/continue/return/throw up for loop/function handling
    if (isReturnSignal(result) || isBreakSignal(result) || isContinueSignal(result) || isThrowSignal(result)) {
      return result;
    }
  }

  return result;
}

// ---------- LOG HELPERS ----------
function firstLineOf(node: any, code: string): string {
    if (!node || !node.range) return "";
    const [start, end] = node.range;
    // Take only a small window; no need to inspect whole function
    let snippet = code.slice(start, Math.min(end, start + 120));

    // 1) Cut at first newline
    const newlineIndex = snippet.indexOf("\n");
    if (newlineIndex !== -1) {
        snippet = snippet.slice(0, newlineIndex);
    }

    // 2) Cut at first '{' (keep the brace, because it's part of header)
    let braceIndex = snippet.indexOf("{");
    if (braceIndex !== -1) {
        snippet = snippet.slice(0, braceIndex + 1);
    }

    // 3) Or cut at first ';' (for simple statements like `let x = 1;`)
    const semiIndex = snippet.indexOf(";");
    if (semiIndex !== -1 && (braceIndex === -1 || semiIndex < braceIndex)) {
        snippet = snippet.slice(0, semiIndex + 1);
    }

    // 4) Safety: hard limit length
    if (snippet.length > 80) {
        snippet = snippet.slice(0, 77) + "...";
    }

    return snippet.trim();
}

function getFirstMeaningfulStatement(block: any): any | null {
  if (!block || block.type !== "BlockStatement") return null;
  for (const stmt of block.body) {
    if (!stmt) continue;
    if (stmt.type !== "EmptyStatement" && stmt.type !== "DebuggerStatement") {
      return stmt;
    }
  }
  return null;
}

function logIfRealStatement(node: any, ctx: EvalContext) {
  const validStatements = new Set([
    "VariableDeclaration",
    "ExpressionStatement",
    "IfStatement",
    "ForStatement",
    "WhileStatement",
    "ReturnStatement",
    "BlockStatement",
    "FunctionDeclaration",
    "ClassDeclaration",
    "BreakStatement",
    "ContinueStatement",
    "SwitchStatement",
    "TryStatement",
    "ThrowStatement",
    "LabeledStatement",
  ]);
  if (node && node.loc && validStatements.has(node.type)) {
    ctx.logger.log(node.loc.start.line - 1);
  }
}

function safeEvaluate(node: any, ctx: EvalContext) {
  return evaluateExpression(node, { ...ctx, safe: true });
}

// ---------- STATEMENT EVALUATION ----------
export function evaluateStatement(node: any, ctx: EvalContext): any {
  if (!node) return;

  logIfRealStatement(node, ctx);

  let result: any;

  switch (node.type) {
    case "VariableDeclaration":
      result = evalVariableDeclaration(node, ctx);
      break;

    case "ExpressionStatement":
      if (node.expression?.range) ctx.logger.addFlow("Evaluating expression statement");
      result = evaluateExpression(node.expression, ctx);
      break;

    case "ReturnStatement": {
      const val = node.argument ? evaluateExpression(node.argument, ctx) : undefined;
      ctx.logger.addFlow(`Return encountered → value: ${JSON.stringify(val)}`);
      ctx.logger.setNext(null, "Return: control returns to caller");
      result = makeReturn(val);
      break;
    }

    case "IfStatement":
      result = evalIf(node, ctx);
      break;

    case "BlockStatement": {
      // always unwrap block to sequential statements so next-step predictor works
      const shouldCreateBlock = ctx.env.kind !== "block" && ctx.env.kind !== "function";
      const newEnv = shouldCreateBlock ? ctx.env.extend("block") : ctx.env;
      const innerCtx: EvalContext = { ...ctx, env: newEnv };

      if (shouldCreateBlock) {
        ctx.logger.setCurrentEnv(newEnv);
        ctx.logger.addFlow("Entering new block scope");
        const first = getFirstMeaningfulStatement(node);
        if (first) {
            ctx.logger.setNext(
                first.loc.start.line - 1,
                "Next Step → " + firstLineOf(first, ctx.logger.getCode())
            );
        }
      }

      result = evaluateBlockBody(node.body, innerCtx);

      if (shouldCreateBlock) {
        ctx.logger.addFlow("Exiting block scope");
        // when leaving block, show next sequential statement
        if (ctx.nextStatement) {
          ctx.logger.setNext(ctx.nextStatement.loc.start.line - 1, `Exit block → ${firstLineOf(ctx.nextStatement, ctx.logger.getCode())}`);
        } else {
          ctx.logger.setNext(null, "Exit block → end of block");
        }
        ctx.logger.setCurrentEnv(ctx.env);
      }
      break;
    }

    case "ForStatement":
      result = evalFor(node, ctx);
      break;

    case "WhileStatement":
      result = evalWhile(node, ctx);
      break;

    case "FunctionDeclaration":
      result = evalFunctionDeclaration(node, ctx);
      break;

    case "ClassDeclaration":
      result = evalClassDeclaration(node, ctx);
      break;

    case "BreakStatement": {
      // optionally with label: node.label?.name
      const label = node.label?.name ?? null;
      ctx.logger.addFlow(`Break encountered${label ? ` → label: ${label}` : ""}`);
      // calling loop/switch will handle setting next-step
      result = makeBreak(label);
      break;
    }

    case "ContinueStatement": {
      const label = node.label?.name ?? null;
      ctx.logger.addFlow(`Continue encountered${label ? ` → label: ${label}` : ""}`);
      result = makeContinue(label);
      break;
    }

    case "LabeledStatement": {
      // Evaluate label body and propagate label-aware break/continue
      const labelName = node.label?.name;
      // push label mapping into ctx.labels (for advanced use)
      const labels = { ...(ctx.labels ?? {}) };
      if (labelName) {
        labels[labelName] = node.body;
      }
      const innerCtx: EvalContext = { ...ctx, labels };
      ctx.logger.addFlow(`Label: ${labelName}`);
      result = evaluateStatement(node.body, innerCtx);
      // If a break with matching label arises, consume it here (stop propagation)
      if (isBreakSignal(result) && result.label === labelName) {
        ctx.logger.addFlow(`Break matched label ${labelName} → exit labeled block`);
        // set next to following statement after this labeled statement
        if (ctx.nextStatement) {
          ctx.logger.setNext(ctx.nextStatement.loc.start.line - 1, `After label ${labelName}: ${firstLineOf(ctx.nextStatement, ctx.logger.getCode())}`);
        } else {
          ctx.logger.setNext(null, `After label ${labelName}: end`);
        }
        return; // consume break
      }
      // If continue with label matches, propagate up for loops to handle
      if (isContinueSignal(result) && result.label === labelName) {
        return result; // loop handler will deal with it
      }
      break;
    }

    case "SwitchStatement":
      result = evalSwitch(node, ctx);
      break;

    case "TryStatement":
      result = evalTry(node, ctx);
      break;

    case "ThrowStatement": {
      const arg = node.argument ? evaluateExpression(node.argument, ctx) : undefined;
      ctx.logger.addFlow(`Throw: ${JSON.stringify(arg)}`);
      result = makeThrow(arg);
      break;
    }

    default:
      // unsupported statement types are ignored for now
      return;
  }

  // GLOBAL FALLBACK NEXT-STEP
  // If no specific next-step was set by clause/loop logic, use sequential prediction.
  if (!ctx.logger.hasNext()) {
    if (ctx.nextStatement) {
      ctx.logger.setNext(ctx.nextStatement.loc.start.line - 1, `Next Step → ${firstLineOf(ctx.nextStatement, ctx.logger.getCode())}`);
    } else {
      ctx.logger.setNext(null, "End of block");
    }
  }

  return result;
}

// ---------- VARIABLE DECLARATION ----------
function evalVariableDeclaration(node: any, ctx: EvalContext) {
  const kind: "var" | "let" | "const" = node.kind;
  for (const decl of node.declarations) {
    const name = decl.id.name;
    const value = decl.init ? evaluateExpression(decl.init, ctx) : undefined;
    if (kind === "var") {
      ctx.env.set(name, value);
    } else {
      ctx.env.record.createMutableBinding(name, kind, value, true);
    }
  }
}

// ---------- IF ----------
function evalIf(node: any, ctx: EvalContext) {
  const test = safeEvaluate(node.test, ctx);
  ctx.logger.addExpressionEval(node.test, test);
  ctx.logger.addExpressionContext(node.test, "If Condition");
  ctx.logger.addFlow("IF CHECK:");
  ctx.logger.addFlow(`Result: ${test ? "TRUE → taking THEN branch" : "FALSE → taking ELSE / skipping"}`);

  if (test) {
    const target = node.consequent;
    const first = target.type === "BlockStatement"
        ? getFirstMeaningfulStatement(target)
        : target;
    
    if (first) {
        ctx.logger.setNext(
            first.loc.start.line - 1,
            "Next Step → " + firstLineOf(first, ctx.logger.getCode())
        );
    }

    // execute consequential node carefully: if it's a block, unwrap to sequential statements
    if (target.type === "BlockStatement") {
      const newEnv = ctx.env.extend("block");
      const innerCtx: EvalContext = { ...ctx, env: newEnv, nextStatement: ctx.nextStatement };
      ctx.logger.setCurrentEnv(newEnv);
      const res = evaluateBlockBody(target.body, innerCtx);
      ctx.logger.setCurrentEnv(ctx.env);
      return res;
    } else {
      return evaluateStatement(target, ctx);
    }
  } else if (node.alternate) {
    const target = node.alternate;
    const first = target.type === "BlockStatement"
        ? getFirstMeaningfulStatement(target)
        : target;
    
    if (first) {
        ctx.logger.setNext(
            first.loc.start.line - 1,
            "Next Step → " + firstLineOf(first, ctx.logger.getCode())
        );
    }
    
    if (target.type === "BlockStatement") {
      const newEnv = ctx.env.extend("block");
      const innerCtx: EvalContext = { ...ctx, env: newEnv, nextStatement: ctx.nextStatement };
      ctx.logger.setCurrentEnv(newEnv);
      const res = evaluateBlockBody(target.body, innerCtx);
      ctx.logger.setCurrentEnv(ctx.env);
      return res;
    } else {
      return evaluateStatement(target, ctx);
    }
  } else {
    // no else; next is the sequential nextStatement
    if (ctx.nextStatement) {
      ctx.logger.setNext(ctx.nextStatement.loc.start.line - 1, `If false → continue to ${firstLineOf(ctx.nextStatement, ctx.logger.getCode())}`);
    }
  }
}

// ---------- FOR ----------
function evalFor(node: any, ctx: EvalContext) {
  const loopEnv = ctx.env.extend("block");
  const loopCtx: EvalContext = { ...ctx, env: loopEnv };

  // init
  if (node.init) {
    ctx.logger.setCurrentEnv(loopEnv);
    ctx.logger.addFlow("FOR LOOP INIT:");
    if (node.init.type === "VariableDeclaration") {
      evalVariableDeclaration(node.init, loopCtx);
    } else {
      evaluateExpression(node.init, loopCtx);
    }
  }

  let iteration = 0;
  let result: any;

  while (true) {
    iteration++;
    ctx.logger.setCurrentEnv(loopEnv);

    // test
    if (node.test) {
      logIfRealStatement(node.test, loopCtx);
      const test = safeEvaluate(node.test, loopCtx);
      ctx.logger.addExpressionEval(node.test, test);
      ctx.logger.addExpressionContext(node.test, "For Loop Condition");
      ctx.logger.addFlow(`FOR LOOP CHECK (iteration #${iteration})`);
      ctx.logger.addFlow(`Result: ${test ? "TRUE → enter loop body" : "FALSE → exit loop"}`);

      if (!test) {
        // exiting loop: next is statement after the for
        ctx.logger.setNext(node.loc.end.line, `Exit FOR loop → ${firstLineOf(ctx.nextStatement, ctx.logger.getCode())}`);
        break;
      }

    } else {
      // for(;;) infinite—still set next to body
    }

     // entering body
    const first = node.body.type === "BlockStatement"
        ? getFirstMeaningfulStatement(node.body)
        : node.body;
    if (first) {
        ctx.logger.setNext(
            first.loc.start.line - 1,
            "Next Step → " + firstLineOf(first, ctx.logger.getCode())
        );
    }


    // execute body
    const res = (node.body.type === "BlockStatement")
      ? (function() {
          // evaluate block inside loop scope
          const innerRes = evaluateBlockBody(node.body.body, loopCtx);
          return innerRes;
        })()
      : evaluateStatement(node.body, loopCtx);

    if (isBreakSignal(res)) {
      // break: if labeled or not, decide whether to consume or bubble up
      if (!res.label) {
        ctx.logger.setNext(node.loc.end.line, `Break → exit FOR loop. Next: ${firstLineOf(ctx.nextStatement, ctx.logger.getCode())}`);
        break;
      } else {
        // labelled break: bubble up (so LabeledStatement can consume)
        return res;
      }
    }
    if (isContinueSignal(res)) {
      // continue: if labelled and doesn't match this loop, bubble up, else continue to update
      if (res.label && (!ctx.labels || !ctx.labels[res.label])) {
        return res;
      }
      // else continue with update
      // proceed to update step immediately
    }
    if (isReturnSignal(res) || isThrowSignal(res)) {
      result = res;
      break;
    }

    // update
    if (node.update) {
      ctx.logger.addFlow("FOR LOOP UPDATE:");
      logIfRealStatement(node.update, loopCtx);
      evaluateExpression(node.update, loopCtx);
      // after update, next step is test
      if (node.test?.loc) {
        ctx.logger.setNext(node.test.loc.start.line - 1, "Go to loop condition check");
      }
    }
  }

  ctx.logger.setCurrentEnv(ctx.env);
  return result;
}

// ---------- WHILE ----------
function evalWhile(node: any, ctx: EvalContext) {
  const loopEnv = ctx.env.extend("block");
  const loopCtx: EvalContext = { ...ctx, env: loopEnv };

  let result: any;
  let iteration = 0;

  while (true) {
    iteration++;
    ctx.logger.setCurrentEnv(loopEnv);

    logIfRealStatement(node.test, loopCtx);
    const test = safeEvaluate(node.test, loopCtx);
    ctx.logger.addExpressionEval(node.test, test);
    ctx.logger.addExpressionContext(node.test, "While Loop Condition");
    ctx.logger.addFlow("WHILE LOOP CHECK:");
    ctx.logger.addFlow(`Iteration #${iteration}`);
    ctx.logger.addFlow(`Result: ${test ? "TRUE → continue loop" : "FALSE → exit loop"}`);

    if (!test) {
      ctx.logger.setNext(node.loc.end.line, `Exit WHILE loop → ${firstLineOf(ctx.nextStatement, ctx.logger.getCode())}`);
      break;
    }

    const first = getFirstMeaningfulStatement(node.body);
    if (first) {
        ctx.logger.setNext(
            first.loc.start.line - 1,
            "Next Step → " + firstLineOf(first, ctx.logger.getCode())
        );
    }

    const res = (node.body.type === "BlockStatement")
      ? evaluateBlockBody(node.body.body, loopCtx)
      : evaluateStatement(node.body, loopCtx);

    if (isBreakSignal(res)) {
      if (!res.label) {
        ctx.logger.setNext(node.loc.end.line, `Break → exit WHILE loop. Next: ${firstLineOf(ctx.nextStatement, ctx.logger.getCode())}`);
        break;
      } else {
        return res;
      }
    }
    if (isContinueSignal(res)) {
      if (res.label && (!ctx.labels || !ctx.labels[res.label])) {
        return res;
      }
      // else continue to next iteration (loop naturally continues)
      continue;
    }
    if (isReturnSignal(res) || isThrowSignal(res)) {
      result = res;
      break;
    }
  }

  ctx.logger.setCurrentEnv(ctx.env);
  return result;
}

// ---------- SWITCH ----------
function evalSwitch(node: any, ctx: EvalContext) {
  const disc = evaluateExpression(node.discriminant, ctx);
  ctx.logger.addFlow(`SWITCH discriminant evaluated → ${JSON.stringify(disc)}`);
  let matchedIndex = -1;
  let defaultIndex = -1;

  // find first matching case (or default)
  for (let i = 0; i < node.cases.length; i++) {
    const c = node.cases[i];
    if (c.test === null) {
      // default
      defaultIndex = i;
    } else {
      const testVal = evaluateExpression(c.test, ctx);
      if (testVal === disc) {
        matchedIndex = i;
        break; // stop at first match
      }
    }
  }
  
  if(matchedIndex === -1) {
      matchedIndex = defaultIndex;
  }


  if (matchedIndex === -1) {
    // no case matched & no default: continue to next statement
    ctx.logger.addFlow("SWITCH: no case matched");
    return;
  }

  // execute cases from matchedIndex onwards until break
  for (let i = matchedIndex; i < node.cases.length; i++) {
    const c = node.cases[i];

    for (let stmt of c.consequent) {
      const res = evaluateStatement(stmt, ctx);
      if (isBreakSignal(res)) {
        // break inside switch consumes break (no label) and stop switch
        if (!res.label) {
          ctx.logger.addFlow("SWITCH: break → end switch");
          // next step after switch
          if (ctx.nextStatement) {
            ctx.logger.setNext(ctx.nextStatement.loc.start.line - 1, `After switch → ${firstLineOf(ctx.nextStatement, ctx.logger.getCode())}`);
          }
          return;
        } else {
          // label break: bubble up
          return res;
        }
      }
      if (isReturnSignal(res) || isThrowSignal(res) || isContinueSignal(res)) {
        return res; // propagate
      }
    }
  }

  // finished all cases: next is after switch
  if (ctx.nextStatement) {
    ctx.logger.setNext(ctx.nextStatement.loc.start.line - 1, `After switch → ${firstLineOf(ctx.nextStatement, ctx.logger.getCode())}`);
  }
}

// ---------- TRY / CATCH / FINALLY ----------
function evalTry(node: any, ctx: EvalContext) {
  // try block
  ctx.logger.addFlow("TRY block start");
  let res = (node.block.type === "BlockStatement")
    ? (function() {
        // new block env for try
        const newEnv = ctx.env.extend("block");
        const innerCtx = { ...ctx, env: newEnv };
        ctx.logger.setCurrentEnv(newEnv);
        const r = evaluateBlockBody(node.block.body, innerCtx);
        ctx.logger.setCurrentEnv(ctx.env);
        return r;
      })()
    : evaluateStatement(node.block, ctx);

  if (isThrowSignal(res)) {
    // if there's a catch clause, bind the thrown value to the param and execute catch
    if (node.handler) {
      const catchParam = node.handler.param?.name;
      const catchBody = node.handler.body; // BlockStatement
      ctx.logger.addFlow("Exception caught → entering catch");
      const catchEnv = ctx.env.extend("block");
      const innerCtx: EvalContext = { ...ctx, env: catchEnv };
      // bind exception variable
      if (catchParam) {
        catchEnv.record.createMutableBinding(catchParam, "let", res.value, true);
      }
      ctx.logger.setCurrentEnv(catchEnv);
      res = evaluateBlockBody(catchBody.body, innerCtx);
      ctx.logger.setCurrentEnv(ctx.env);
    } else {
      // no catch: propagate throw to caller after finally runs
    }
  }

  // finally always runs if present
  if (node.finalizer) {
    ctx.logger.addFlow("Entering finally");
    const finEnv = ctx.env.extend("block");
    const finCtx: EvalContext = { ...ctx, env: finEnv };
    ctx.logger.setCurrentEnv(finEnv);
    const finRes = evaluateBlockBody(node.finalizer.body, finCtx);
    ctx.logger.setCurrentEnv(ctx.env);
    // If finally produced control signal, it overrides previous (mimic JS behavior)
    if (isReturnSignal(finRes) || isThrowSignal(finRes) || isBreakSignal(finRes) || isContinueSignal(finRes)) {
      return finRes;
    }
  }

  // propagate result (might be throw if not caught)
  return res;
}

// ---------- FUNCTION / CLASS ----------
function evalFunctionDeclaration(node: any, ctx: EvalContext) {
  const name = node.id.name;
  const fn = createUserFunction(node, ctx.env);
  ctx.env.record.initializeBinding(name, fn);
}

function evalClassDeclaration(node: any, ctx: EvalContext) {
  const name = node.id.name;
  const cls = createClassConstructor(node, ctx);
  ctx.env.record.initializeBinding(name, cls);
}

// ---------- EXPRESSIONS ----------
function evaluateExpression(node: any, ctx: EvalContext): any {
  if (!node) return;

  if (ctx.safe) {
    if (node.type === "AssignmentExpression") return undefined;
    if (node.type === "UpdateExpression") {
      if (node.argument.type === "Identifier") return ctx.env.get(node.argument.name);
      return undefined;
    }
    if (node.type === "CallExpression") return "[Side Effect]";
  }

  switch (node.type) {
    case "Identifier":
      return ctx.env.get(node.name);

    case "Literal":
      return node.value;

    case "BinaryExpression": {
      const left = evaluateExpression(node.left, ctx);
      const right = evaluateExpression(node.right, ctx);
      switch (node.operator) {
        case "+": return left + right;
        case "-": return left - right;
        case "*": return left * right;
        case "/": return left / right;
        case "%": return left % right;
        case "===": return left === right;
        case "!==": return left !== right;
        case "==": return left == right;
        case "!=": return left != right;
        case ">": return left > right;
        case "<": return left < right;
        case ">=": return left >= right;
        case "<=": return left <= right;
        default:
          throw new Error(`Unsupported binary operator: ${node.operator}`);
      }
    }

    case "LogicalExpression": {
      const left = evaluateExpression(node.left, ctx);
      if (node.operator === "&&") {
        return left && evaluateExpression(node.right, ctx);
      } else if (node.operator === "||") {
        return left || evaluateExpression(node.right, ctx);
      }
      throw new Error(`Unsupported logical operator: ${node.operator}`);
    }

    case "AssignmentExpression": {
      if (node.left.type === "Identifier") {
        const value = evaluateExpression(node.right, ctx);
        ctx.env.set(node.left.name, value);
        return value;
      }
      if (node.left.type === "MemberExpression") {
        const { object, property } = evalMemberTarget(node.left, ctx);
        const value = evaluateExpression(node.right, ctx);
        setProperty(object, property, value);
        return value;
      }
      throw new Error("Unsupported assignment target");
    }

    case "UpdateExpression": {
      const argNode = node.argument;
      if (argNode.type === "Identifier") {
        const name = argNode.name;
        const current = ctx.env.get(name);
        const next = node.operator === "++" ? current + 1 : current - 1;
        ctx.env.set(name, next);
        return node.prefix ? next : current;
      }
      throw new Error("Unsupported update target");
    }

    case "CallExpression":
      return evalCallExpression(node, ctx);

    case "MemberExpression": {
      const { object, property } = evalMemberTarget(node, ctx);
      return getProperty(object, property);
    }

    case "ArrowFunctionExpression":
    case "FunctionExpression":
      return createUserFunction(node, ctx.env);

    case "NewExpression":
      return evalNewExpression(node, ctx);

    case "ArrayExpression":
      return node.elements.map((el: any) => (el ? evaluateExpression(el, ctx) : null));

    case "ObjectExpression": {
      const obj = createObject(Object.prototype as any);
      for (const prop of node.properties) {
        const key = prop.key.type === "Identifier" ? prop.key.name : evaluateExpression(prop.key, ctx);
        const value = evaluateExpression(prop.value, ctx);
        setProperty(obj, key, value);
      }
      return obj;
    }

    case "ThisExpression":
      return ctx.thisValue;

    default:
      // unsupported expression types return undefined
      return undefined;
  }
}

function evalMemberTarget(node: any, ctx: EvalContext) {
  const object = evaluateExpression(node.object, ctx);
  let property: any;
  if (node.computed) {
    property = evaluateExpression(node.property, ctx);
  } else {
    property = node.property.name;
  }
  return { object, property };
}

// ---------- FUNCTION / CLASS IMPLEMENTATIONS ----------
function createUserFunction(node: any, env: LexicalEnvironment): FunctionValue {
  const params = node.params ?? [];
  const body = node.body;

  // Implementation that will be attached to FunctionValue via createFunction
  const functionImplementation = function (this: FunctionValue, thisArg: any, args: any[]) {
    const funcName = node.id?.name || node.key?.name || "Function";
    const fnEnv = new LexEnv(funcName, "function", new EnvironmentRecord(), this.__env);

    let callThisValue = thisArg;
    if (node.type === "ArrowFunctionExpression") {
      callThisValue = this.__env.get("this");
    }

    this.__params.forEach((param: any, index: number) => {
        if(param.type === 'Identifier') {
          const name = param.name;
          fnEnv.record.createMutableBinding(name, "var", args[index], true);
        }
    });

    const logger = this.__ctx?.logger as TimelineLogger;
    const stack = this.__ctx?.stack ?? [];
    logger.setCurrentEnv(fnEnv);
    logger.addFlow(`Entering function ${funcName}`);

    const innerCtx: EvalContext = {
      env: fnEnv,
      thisValue: callThisValue,
      logger,
      stack,
    };

    const first = body.type === "BlockStatement" ? getFirstMeaningfulStatement(body) : body;
    if (first) {
        logger.setNext(first.loc.start.line - 1, `Next Step → ${firstLineOf(first, logger.getCode())}`);
    }


    const stackName = funcName || "<anonymous>";
    innerCtx.stack.push(stackName);

    let result;
    if (this.__body.type !== "BlockStatement") {
      result = evaluateExpression(this.__body, innerCtx);
    } else {
      hoistProgram({ body: this.__body.body }, fnEnv);
      result = evaluateBlockBody(this.__body.body, innerCtx);
    }

    innerCtx.stack.pop();
    logger.addFlow(`Returning from function ${funcName}`);
    logger.setCurrentEnv(this.__env);

    if (isReturnSignal(result)) return result.value;
    return this.__body.type !== "BlockStatement" ? result : undefined;
  };

  const fn = createFunction(env, params, body, functionImplementation);
  return fn;
}

function evalCallExpression(node: any, ctx: EvalContext): any {
  const calleeVal = evaluateExpression(node.callee, ctx);
  const args = node.arguments.map((arg: any) => evaluateExpression(arg, ctx));

  let thisArg: any;
  if (node.callee.type === "MemberExpression") {
    const { object } = evalMemberTarget(node.callee, ctx);
    thisArg = object;
  } else {
    thisArg = ctx.thisValue ?? undefined;
  }

  // console.log builtin
  if (calleeVal && (calleeVal as any).__builtin === "console.log") {
    ctx.logger.logOutput(...args);
    return undefined;
  }

  // Native JS functions
  if (typeof calleeVal === "function" && !isUserFunction(calleeVal)) {
    return calleeVal.apply(thisArg, args);
  }

  // Our teaching function
  if (isUserFunction(calleeVal)) {
    const fn = calleeVal as FunctionValue;
    if (!fn.__ctx) fn.__ctx = { logger: ctx.logger, stack: ctx.stack };
    const result = fn.call(thisArg, args);
    if (isReturnSignal(result)) return result.value;
    return result;
  }

  throw new Error("Call of non-function value");
}

function evalNewExpression(node: any, ctx: EvalContext): any {
  const ctor = evaluateExpression(node.callee, ctx);
  const args = node.arguments.map((arg: any) => evaluateExpression(arg, ctx));

  if (ctor && typeof (ctor as any).construct === "function") {
    return (ctor as any).construct(args);
  }

  if (typeof ctor === "function") {
    const instance = createObject((ctor as any).prototype || Object.prototype);
    const res = ctor.apply(instance, args);
    return res !== null && typeof res === "object" ? res : instance;
  }

  throw new Error("new operator used on non-constructible value");
}

function createClassConstructor(node: any, ctx: EvalContext): FunctionValue {
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

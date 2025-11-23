// src/engine/evaluator.ts

import type { LexicalEnvironment } from "./environment";
import { EnvironmentRecord, LexicalEnvironment as LexEnv } from "./environment";
import { TimelineLogger } from "./timeline";
import {
  createFunction,
  createObject,
  setPrototype,
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
}

// A special object to signal a return statement has been executed.
interface ReturnSignal {
  __type: "Return";
  value: any;
}
interface BreakSignal {
  __type: "Break";
}

function makeReturn(value: any): ReturnSignal {
  return { __type: "Return", value };
}
function makeBreak(): BreakSignal {
    return { __type: "Break" };
}

function isReturnSignal(val: any): val is ReturnSignal {
  return val && val.__type === "Return";
}

function isBreakSignal(val: any): val is BreakSignal {
    return val && val.__type === "Break";
}

/**
 * Scans the top-level of a program or function body for declarations
 * that need to be "hoisted" before execution begins.
 */
export function hoistProgram(ast: any, env: LexicalEnvironment) {
  // Simple hoisting: function declarations + var + class
  for (const node of ast.body ?? []) {
    if (node.type === "FunctionDeclaration") {
      const rec = env.record;
      if (!rec.hasBinding?.(node.id.name)) {
        rec.createMutableBinding(node.id.name, "function", undefined, false);
      }
    } else if (node.type === "VariableDeclaration" && node.kind === "var") {
      for (const decl of node.declarations) {
        const name = decl.id.name;
        if (!env.record.hasBinding(name)) {
          env.record.createMutableBinding(name, "var", undefined, true);
        }
      }
    } else if (node.type === "ClassDeclaration") {
      if (!env.record.hasBinding(node.id.name)) {
        env.record.createMutableBinding(node.id.name, "class", undefined, false);
      }
    }
  }
}

/**
 * The main entry point for evaluating a program's AST.
 */
export function evaluateProgram(ast: any, ctx: EvalContext): any {
  hoistProgram(ast, ctx.env);
  return evaluateBlockBody(ast.body, ctx);
}

/**
 * Evaluates an array of statements within a block.
 */
function evaluateBlockBody(body: any[], ctx: EvalContext): any {
  let result: any;
  for (let i = 0; i < body.length; i++) {
    const stmt = body[i];
    
    // Find next *meaningful* statement for logging
    let nextStmt: any = null;
    for (let j = i + 1; j < body.length; j++) {
        if (body[j] && body[j].type !== 'EmptyStatement' && body[j].type !== 'DebuggerStatement') {
            nextStmt = body[j];
            break;
        }
    }

    const statementCtx = { ...ctx, nextStatement: nextStmt };

    result = evaluateStatement(stmt, statementCtx);
    // If a return statement is executed, stop and propagate the signal up.
    if (isReturnSignal(result) || isBreakSignal(result)) {
      return result;
    }
  }
  return result;
}

/**
 * Logs the current execution state to the timeline if the node is a meaningful statement.
 */
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
      "BreakStatement"
    ]);
  
    if (node && node.loc && validStatements.has(node.type)) {
      ctx.logger.log(node.loc.start.line - 1);
    }
  }

function safeEvaluate(node: any, ctx: EvalContext) {
    return evaluateExpression(node, {
      ...ctx,
      safe: true,
    });
}

function sourceOf(node: any, code: string) {
    if (!node || !node.range) return '';
    const source = code.substring(node.range[0], node.range[1]);
    // Return just the first line for brevity
    return source.split('\n')[0];
}
  

/**
 * Evaluates a single statement node from the AST.
 */
function evaluateStatement(node: any, ctx: EvalContext & { nextStatement?: any }): any {
  if (!node) return;

  logIfRealStatement(node, ctx);

  let result;
  switch (node.type) {
    case "VariableDeclaration":
      result = evalVariableDeclaration(node, ctx);
      break;
    case "ExpressionStatement": {
      // simple human message: "we are evaluating this whole expression"
      if (node.expression.range) {
        // we can't access source here, but expressionEval + line number will carry enough info
        ctx.logger.addFlow("Evaluating expression statement");
      }
      result = evaluateExpression(node.expression, ctx);
      // 🔥 REQUIRED: Guarantee next-step for standalone expressions
      if (!ctx.logger.hasNext()) {
        if (ctx.nextStatement) {
          ctx.logger.setNext(
            ctx.nextStatement.loc.start.line - 1,
            `Next → ${sourceOf(ctx.nextStatement, ctx.logger.getCode())}`
          );
        } else {
          ctx.logger.setNext(null, "End of block");
        }
      }
      break;
    }
    case "ReturnStatement": {
      const val = node.argument ? evaluateExpression(node.argument, ctx) : undefined;
      ctx.logger.addFlow(`Return encountered → value: ${JSON.stringify(val)}`);
      ctx.logger.setNext(
        null,
        "Return → function finishes and control goes back to caller"
      );
      result = makeReturn(val);
      break;
    }
    case "IfStatement":
      result = evalIf(node, ctx);
      break;
    case "BlockStatement": {
        const shouldCreateBlock = ctx.env.kind !== "block" && ctx.env.kind !== "function";
        const newEnv = shouldCreateBlock ? ctx.env.extend("block") : ctx.env;
        
        const innerCtx = { ...ctx, env: newEnv };
        
        if (shouldCreateBlock) {
          ctx.logger.setCurrentEnv(newEnv);
          ctx.logger.addFlow("Entering new block scope");
        }
        
        result = evaluateBlockBody(node.body, innerCtx);
        
        if (shouldCreateBlock) {
          ctx.logger.addFlow("Exiting block scope");
          ctx.logger.setCurrentEnv(ctx.env); // Restore parent env
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
    case "BreakStatement":
      ctx.logger.addFlow(`Break encountered`);
      // The calling loop needs to handle setting the next step
      result = makeBreak();
      break;
    default:
      // Unhandled statements can be skipped or throw
      // console.warn("Unsupported statement:", node.type);
      return;
  }
  
    // (GLOBAL FALLBACK NEXT-STEP CALCULATION)
    if (!ctx.logger.hasNext()) {
        if (ctx.nextStatement) {
            ctx.logger.setNext(
                ctx.nextStatement.loc.start.line - 1,
                `Next sequential statement: ${sourceOf(ctx.nextStatement, ctx.logger.getCode())}`
            );
        } else {
            ctx.logger.setNext(null, "End of block");
        }
    }

    return result;
}

/**
 * Handles the declaration of variables (var, let, const).
 */
function evalVariableDeclaration(node: any, ctx: EvalContext) {
    const kind: "var" | "let" | "const" = node.kind;
    for (const decl of node.declarations) {
        const name = decl.id.name;
        const value = decl.init ? evaluateExpression(decl.init, ctx) : undefined;
        
        if (kind === "var") {
            // 'var' is hoisted and function-scoped, here simplified to current env
            ctx.env.set(name, value);
        } else {
            // 'let' and 'const' are block-scoped.
            ctx.env.record.createMutableBinding(name, kind, value, true);
        }
    }
}

function evalIf(node: any, ctx: EvalContext & { nextStatement?: any }) {
  const test = safeEvaluate(node.test, ctx);
  ctx.logger.addExpressionEval(node.test, test);
  ctx.logger.addExpressionContext(node.test, "If Condition");
  ctx.logger.addFlow("IF CHECK:");
  ctx.logger.addFlow(`Result: ${test ? "TRUE → taking THEN branch" : "FALSE → taking ELSE / skipping"}`);

  if (test) {
    ctx.logger.setNext(node.consequent.loc.start.line - 1, `Condition is TRUE → continue to: ${sourceOf(node.consequent, ctx.logger.getCode())}`);
    return evaluateStatement(node.consequent, ctx);
  } else if (node.alternate) {
    ctx.logger.setNext(node.alternate.loc.start.line - 1, `Condition is FALSE → continue to ELSE branch: ${sourceOf(node.alternate, ctx.logger.getCode())}`);
    return evaluateStatement(node.alternate, ctx);
  } else if (ctx.nextStatement) {
    ctx.logger.setNext(ctx.nextStatement.loc.start.line - 1, `Skipping IF, next statement is on line ${ctx.nextStatement.loc.start.line}: ${sourceOf(ctx.nextStatement, ctx.logger.getCode())}`);
  }
}

function evalFor(node: any, ctx: EvalContext) {
  const loopEnv = ctx.env.extend("block");
  const loopCtx: EvalContext = { ...ctx, env: loopEnv };

  // INIT
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

    // TEST
    if (node.test) {
      logIfRealStatement(node.test, loopCtx);
      const test = safeEvaluate(node.test, loopCtx);
      ctx.logger.addExpressionEval(node.test, test);
      ctx.logger.addExpressionContext(node.test, "For Loop Condition");

      ctx.logger.addFlow(`FOR LOOP CHECK (iteration #${iteration})`);
      ctx.logger.addFlow(`Result: ${test ? "TRUE → enter loop body" : "FALSE → exit loop"}`);

      if (!test) {
        ctx.logger.setNext(node.loc.end.line, "Exit FOR loop");
        break;
      }
      ctx.logger.setNext(node.body.loc.start.line -1, `Start loop iteration #${iteration}`);
    }

    const res = evaluateStatement(node.body, loopCtx);
    if (isBreakSignal(res)) {
        ctx.logger.setNext(node.loc.end.line, "Break → exit FOR loop");
        break;
    }
    if (isReturnSignal(res)) {
      result = res;
      break;
    }

    // UPDATE
    if (node.update) {
      ctx.logger.addFlow("FOR LOOP UPDATE:");
      logIfRealStatement(node.update, loopCtx);
      evaluateExpression(node.update, loopCtx);
      ctx.logger.setNext(node.test.loc.start.line - 1, "Go to loop condition check");
    }
  }

  ctx.logger.setCurrentEnv(ctx.env);
  return result;
}

function evalWhile(node: any, ctx: EvalContext) {
  const loopEnv = ctx.env.extend("block");
  const loopCtx: EvalContext = { ...ctx, env: loopEnv };

  let result: any;
  let iteration = 0;

  while (true) {
    iteration++;
    ctx.logger.setCurrentEnv(loopEnv);

    // log condition as a real statement
    logIfRealStatement(node.test, loopCtx);
    const test = safeEvaluate(node.test, loopCtx);

    ctx.logger.addExpressionEval(node.test, test);
    ctx.logger.addExpressionContext(node.test, "While Loop Condition");

    ctx.logger.addFlow("WHILE LOOP CHECK:");
    ctx.logger.addFlow(`Iteration #${iteration}`);
    ctx.logger.addFlow(`Result: ${test ? "TRUE → continue loop" : "FALSE → exit loop"}`);

    if (!test) {
        ctx.logger.setNext(node.loc.end.line, "Exit WHILE loop");
        break;
    }
    ctx.logger.setNext(node.body.loc.start.line - 1, "Enter WHILE body");

    const res = evaluateStatement(node.body, loopCtx);
     if (isBreakSignal(res)) {
        ctx.logger.setNext(node.loc.end.line, "Break → exit WHILE loop");
        break;
    }
    if (isReturnSignal(res)) {
      result = res;
      break;
    }
  }

  ctx.logger.setCurrentEnv(ctx.env);
  return result;
}

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

/**
 * Evaluates a single expression node from the AST and returns its value.
 */
function evaluateExpression(node: any, ctx: EvalContext): any {
  if (!node) return;

  if (ctx.safe) {
    if (node.type === "AssignmentExpression") return undefined;
    if (node.type === "UpdateExpression") return ctx.env.get(node.argument.name);
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
      // This is simplified. Full spec is more complex.
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
        const key =
          prop.key.type === "Identifier" ? prop.key.name : evaluateExpression(prop.key, ctx);
        const value = evaluateExpression(prop.value, ctx);
        setProperty(obj, key, value);
      }
      return obj;
    }
    case "ThisExpression":
        return ctx.thisValue;
    default:
      // console.warn("Unsupported expression:", node.type);
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

// FUNCTIONS, CLOSURES, THIS, NEW, CLASSES

function createUserFunction(node: any, env: LexicalEnvironment): FunctionValue {
  const params = node.params ?? [];
  const body = node.body; // Can be a BlockStatement or an Expression

  // The actual implementation of the function when it's called
  const functionImplementation = function(thisArg: any, args: any[]) {
      const funcName = node.id?.name || (node.parent?.id?.name) || "Function";
      const fnEnv = new LexEnv(funcName, 'function', new EnvironmentRecord(), this.__env);

      let callThisValue = thisArg;
      if (node.type === "ArrowFunctionExpression") {
          callThisValue = this.__env.get('this');
      }

      this.__params.forEach((param: any, index: number) => {
        const name = param.name;
        fnEnv.record.createMutableBinding(name, "var", args[index], true);
      });
      
      const logger = (this as any).__ctx.logger;
      logger.setCurrentEnv(fnEnv);
      logger.addFlow(`Entering function ${funcName}`);

      const innerCtx: EvalContext = {
        env: fnEnv,
        thisValue: callThisValue,
        logger: logger,
        stack: (this as any).__ctx.stack,
      };

      const stackName = node.id?.name || (node.parent?.id?.name) || "<anonymous>";
      innerCtx.stack.push(stackName);

      let result;
      // An arrow function with an expression body, e.g. `() => 1`
      if (this.__body.type !== 'BlockStatement') {
          result = evaluateExpression(this.__body, innerCtx);
      } else {
          // A regular function with a block body
          hoistProgram(this.__body, fnEnv);
          result = evaluateBlockBody(this.__body.body, innerCtx);
      }
      
      innerCtx.stack.pop();
      logger.addFlow(`Returning from function ${funcName}`);
      logger.setCurrentEnv(this.__env); // Restore outer env
      
      if (isReturnSignal(result)) {
        return result.value;
      }
      return (this.__body.type !== 'BlockStatement') ? result : undefined;
  };

  const fn = createFunction(env, params, body, functionImplementation);
  // Store the original AST node on the function value for later reference
  (fn as any).__node = node;
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

  if (calleeVal && calleeVal.__builtin === "console.log") {
    ctx.logger.logOutput(...args);
    return undefined;
  }

  if (typeof calleeVal === "function" && !calleeVal.hasOwnProperty('__isFunctionValue')) {
    return calleeVal.apply(thisArg, args);
  }
  
  if (isUserFunction(calleeVal)) {
    const fn: any = calleeVal;
    
    // 🔥 Add next-step: entering function body
    if (!ctx.logger.hasNext()) {
      const fnNode = fn.__body || fn.__node;
      if (fnNode && fnNode.loc) {
        ctx.logger.setNext(
          fnNode.loc.start.line - 1,
          `Enter function → ${sourceOf(fnNode, ctx.logger.getCode())}`
        );
      }
    }

    if (!fn.__ctx) {
        fn.__ctx = { logger: ctx.logger, stack: ctx.stack };
    }

    const result = fn.call(thisArg, args);
    
    if (isReturnSignal(result)) {
        return result.value;
    }
    // If the body was an expression, the result is its value.
    // If the body was a block, and no return was hit, the result is undefined.
    return result;
  }

  throw new Error("Call of non-function value");
}

function evalNewExpression(node: any, ctx: EvalContext): any {
  const ctor = evaluateExpression(node.callee, ctx);
  const args = node.arguments.map((arg: any) => evaluateExpression(arg, ctx));

  if (ctor && typeof ctor.construct === "function") {
    return ctor.construct(args);
  }

  if (typeof ctor === "function") {
    const instance = createObject((ctor as any).prototype || Object.prototype);
    const res = ctor.apply(instance, args);
    return (res !== null && typeof res === "object") ? res : instance;
  }

  throw new Error("new operator used on non-constructible value");
}

function createClassConstructor(node: any, ctx: EvalContext): FunctionValue {
  const classBody = node.body;
  const ctorMethod = classBody.body.find((m: any) => m.kind === "constructor");

  const baseCtor = createUserFunction(
    ctorMethod ?? {
      type: "FunctionExpression",
      id: null,
      params: [],
      body: { type: "BlockStatement", body: [] }
    },
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

    if (!fn.__ctx) {
        fn.__ctx = { logger: ctx.logger, stack: ctx.stack };
    }
    
    const funcName = node.id?.name || "<constructor>";
    ctx.stack.push(funcName);
    const logger = fn.__ctx.logger;
    logger.setCurrentEnv(fn.__env);

    const result = fn.call(instance, args);

    ctx.stack.pop();
    logger.setCurrentEnv(ctx.env);
    
    if (isReturnSignal(result)) {
        if(typeof result.value === 'object' && result.value !== null) {
            return result.value;
        }
    }
    return instance;
  };

  return baseCtor;
}

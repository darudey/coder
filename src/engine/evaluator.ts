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
  setProperty
} from "./values";

export interface EvalContext {
  env: LexicalEnvironment;
  thisValue: any;
  logger: TimelineLogger;
  stack: string[];
}

// A special object to signal a return statement has been executed.
interface ReturnSignal {
  __type: "Return";
  value: any;
}

function makeReturn(value: any): ReturnSignal {
  return { __type: "Return", value };
}

function isReturnSignal(val: any): val is ReturnSignal {
  return val && val.__type === "Return";
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
  for (const stmt of body) {
    result = evaluateStatement(stmt, ctx);
    // If a return statement is executed, stop and propagate the signal up.
    if (isReturnSignal(result)) {
      return result;
    }
  }
  return result;
}

/**
 * Logs the current execution state to the timeline.
 */
function logNode(node: any, ctx: EvalContext) {
  if (node && node.loc) {
    ctx.logger.log(node.loc.start.line - 1);
  }
}

/**
 * Evaluates a single statement node from the AST.
 */
function evaluateStatement(node: any, ctx: EvalContext): any {
  if (!node) return;

  logNode(node, ctx);

  switch (node.type) {
    case "VariableDeclaration":
      return evalVariableDeclaration(node, ctx);
    case "ExpressionStatement":
      return evaluateExpression(node.expression, ctx);
    case "ReturnStatement": {
      const val = node.argument ? evaluateExpression(node.argument, ctx) : undefined;
      return makeReturn(val);
    }
    case "IfStatement":
      return evalIf(node, ctx);
    case "BlockStatement": {
      const newEnv = ctx.env.extend();
      const innerCtx = { ...ctx, env: newEnv };
      return evaluateBlockBody(node.body, innerCtx);
    }
    case "ForStatement":
      return evalFor(node, ctx);
    case "WhileStatement":
      return evalWhile(node, ctx);
    case "FunctionDeclaration":
      return evalFunctionDeclaration(node, ctx);
    case "ClassDeclaration":
      return evalClassDeclaration(node, ctx);
    default:
      // Unhandled statements can be skipped or throw
      // console.warn("Unsupported statement:", node.type);
      return;
  }
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

function evalIf(node: any, ctx: EvalContext) {
  const test = evaluateExpression(node.test, ctx);
  if (test) {
    return evaluateStatement(node.consequent, ctx);
  } else if (node.alternate) {
    return evaluateStatement(node.alternate, ctx);
  }
}

function evalFor(node: any, ctx: EvalContext) {
  const loopEnv = ctx.env.extend();
  const loopCtx: EvalContext = { ...ctx, env: loopEnv };

  if (node.init) {
    if (node.init.type === "VariableDeclaration") {
      evalVariableDeclaration(node.init, loopCtx);
    } else {
      evaluateExpression(node.init, loopCtx);
    }
  }

  while (true) {
    if (node.test) {
      const test = evaluateExpression(node.test, loopCtx);
      if (!test) break;
    }

    const res = evaluateStatement(node.body, loopCtx);
    if (isReturnSignal(res)) return res;

    if (node.update) {
      evaluateExpression(node.update, loopCtx);
    }
  }
}

function evalWhile(node: any, ctx: EvalContext) {
  while (true) {
    const test = evaluateExpression(node.test, ctx);
    if (!test) break;
    const res = evaluateStatement(node.body, ctx);
    if (isReturnSignal(res)) return res;
  }
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

  logNode(node, ctx);

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
  const body = node.body.type === "BlockStatement" ? node.body : { type: "BlockStatement", body: [ { type: "ReturnStatement", argument: node.body } ] };

  // The actual implementation of the function when it's called
  const functionImplementation = function(thisArg: any, args: any[]) {
      // 'this' refers to the FunctionValue object itself
      // The captured env is on `this.__env`
      const fnEnvRecord = new EnvironmentRecord();
      const fnEnv = new LexEnv(fnEnvRecord, this.__env);

      // Bind 'this' for arrow functions vs regular functions
      let callThisValue = thisArg;
      if (node.type === "ArrowFunctionExpression") {
          // Arrow functions inherit 'this' from their captured environment context
          callThisValue = this.__env.get('this');
      }

      // bind params
      this.__params.forEach((param: any, index: number) => {
        const name = param.name;
        fnEnvRecord.createMutableBinding(name, "var", args[index], true);
      });

      // The context for the function's execution
      const innerCtx: EvalContext = {
        env: fnEnv,
        thisValue: callThisValue,
        logger: (this as any).__ctx.logger, // context is attached by evalCallExpression
        stack: (this as any).__ctx.stack,
      };

      const funcName = node.id?.name || (node.parent?.id?.name) || "<anonymous>";
      innerCtx.stack.push(funcName);

      const result = evaluateBlockBody(this.__body.body, innerCtx);

      innerCtx.stack.pop();
      return result;
  };

  const fn = createFunction(env, params, body, functionImplementation);
  return fn;
}

function evalCallExpression(node: any, ctx: EvalContext): any {
  const calleeVal = evaluateExpression(node.callee, ctx);
  const args = node.arguments.map((arg: any) => evaluateExpression(arg, ctx));

  let thisArg: any;

  if (node.callee.type === "MemberExpression") {
    // For calls like `obj.method()`, `this` is `obj`
    const { object } = evalMemberTarget(node.callee, ctx);
    thisArg = object;
  } else {
    // For calls like `myFunc()`, `this` is the global object or undefined in strict mode
    thisArg = ctx.thisValue ?? undefined; 
  }

  // Handle built-in functions (like console.log)
  if (calleeVal && calleeVal.__builtin === "console.log") {
    ctx.logger.logOutput(...args);
    return undefined;
  }

  // Handle native JS functions (like Math.pow)
  if (typeof calleeVal === "function" && !calleeVal.hasOwnProperty('__isFunctionValue')) {
    return calleeVal.apply(thisArg, args);
  }
  
  // Handle our custom FunctionValue
  if (calleeVal && typeof calleeVal.call === "function") {
    const fn: any = calleeVal;
    
    // Attach the runtime context to the function object just before the call
    if (!fn.__ctx) fn.__ctx = ctx;

    const result = fn.call(thisArg, args);
    
    // Un-wrap a return signal if we get one
    if (isReturnSignal(result)) {
        return result.value;
    }
    return result; // Undefined for functions without an explicit return
  }

  throw new Error("Call of non-function value");
}

function evalNewExpression(node: any, ctx: EvalContext): any {
  const ctor = evaluateExpression(node.callee, ctx);
  const args = node.arguments.map((arg: any) => evaluateExpression(arg, ctx));

  // Handle our custom class constructors
  if (ctor && typeof ctor.construct === "function") {
    return ctor.construct(args);
  }

  // Handle native JS constructors
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
  
  // Attach methods to the prototype
  for (const el of classBody.body) {
    if (el.type === "MethodDefinition" && el.kind !== "constructor") {
      const methodName = el.key.name;
      const methodFn = createUserFunction(el.value, ctx.env);
      setProperty(proto, methodName, methodFn);
    }
  }

  (baseCtor as any).prototype = proto;
  (baseCtor as any).__isClassConstructor = true;

  // Add the special 'construct' behavior for the `new` operator
  (baseCtor as any).construct = (args: any[]) => {
    const instance = createObject(proto);
    const fn: any = baseCtor;

    // Attach runtime context for the call
    if (!fn.__ctx) fn.__ctx = ctx;
    
    const funcName = node.id?.name || "<constructor>";
    ctx.stack.push(funcName);

    const result = fn.call(instance, args);

    ctx.stack.pop();
    
    if (isReturnSignal(result)) {
        if(typeof result.value === 'object' && result.value !== null) {
            return result.value; // if ctor returns an object, use that
        }
    }
    return instance; // otherwise, use the created instance
  };

  return baseCtor;
}

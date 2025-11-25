
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
  nextStatement?: any; // used for next-step prediction inside a block
}

// Signals for control flow
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

// ---------- HOISTING ----------

export function hoistProgram(ast: any, env: LexicalEnvironment) {
  for (const node of ast.body ?? []) {
    if (node.type === "FunctionDeclaration") {
      const rec = env.record;
      if (!rec.hasBinding(node.id.name)) {
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

// ---------- MAIN ENTRY ----------

export function evaluateProgram(ast: any, ctx: EvalContext): any {
  hoistProgram(ast, ctx.env);
  return evaluateBlockBody(ast.body, ctx);
}

// ---------- BLOCK EVALUATION ----------

function evaluateBlockBody(body: any[], ctx: EvalContext): any {
  let result: any;

  for (let i = 0; i < body.length; i++) {
    const stmt = body[i];

    // next *meaningful* statement for next-step prediction
    let nextStmt: any = null;
    for (let j = i + 1; j < body.length; j++) {
      const candidate = body[j];
      if (
        candidate &&
        candidate.type !== "EmptyStatement" &&
        candidate.type !== "DebuggerStatement"
      ) {
        nextStmt = candidate;
        break;
      }
    }

    const statementCtx: EvalContext = { ...ctx, nextStatement: nextStmt };
    result = evaluateStatement(stmt, statementCtx);
    if (isReturnSignal(result) || isBreakSignal(result)) {
      return result;
    }
  }

  return result;
}

// ---------- LOGGING & HELPERS ----------

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
      if (node.expression.range) {
        ctx.logger.addFlow("Evaluating expression statement");
      }
      result = evaluateExpression(node.expression, ctx);
      break;

    case "ReturnStatement": {
      const val = node.argument ? evaluateExpression(node.argument, ctx) : undefined;
      ctx.logger.addFlow(`Return encountered → value: ${JSON.stringify(val)}`);
      ctx.logger.setNext(null, "Function returns → execution ends");
      result = makeReturn(val);
      break;
    }

    case "IfStatement":
      result = evalIf(node, ctx);
      break;

    case "BlockStatement": {
      const shouldCreateBlock =
        ctx.env.kind !== "block" && ctx.env.kind !== "function";
      const newEnv = shouldCreateBlock ? ctx.env.extend("block") : ctx.env;
      const innerCtx: EvalContext = { ...ctx, env: newEnv };

      if (shouldCreateBlock) {
        ctx.logger.setCurrentEnv(newEnv);
        ctx.logger.addFlow("Entering new block scope");
      }

      result = evaluateBlockBody(node.body, innerCtx);

      if (shouldCreateBlock) {
        ctx.logger.addFlow("Exiting block scope");
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

    case "BreakStatement":
      ctx.logger.addFlow("Break encountered");
      result = makeBreak();
      break;

    default:
      return;
  }

  // GLOBAL FALLBACK NEXT-STEP
  if (!ctx.logger.hasNext()) {
    if (ctx.nextStatement) {
      ctx.logger.setNext(
        ctx.nextStatement.loc.start.line - 1,
        `Next Step → ${firstLineOf(
          ctx.nextStatement,
          ctx.logger.getCode()
        )}`
      );
    } else {
      ctx.logger.setNext(null, "End of block");
    }
  }

  return result;
}

// ---------- SPECIFIC STATEMENTS ----------

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

function evalIf(node: any, ctx: EvalContext) {
  const test = safeEvaluate(node.test, ctx);
  ctx.logger.addExpressionEval(node.test, test);
  ctx.logger.addExpressionContext(node.test, "If Condition");
  ctx.logger.addFlow("IF CHECK:");
  ctx.logger.addFlow(
    `Result: ${
      test ? "TRUE → taking THEN branch" : "FALSE → taking ELSE / skipping"
    }`
  );

  if (test) {
    ctx.logger.setNext(
      node.consequent.loc.start.line - 1,
      `Condition is TRUE → continue to: ${firstLineOf(node.consequent, ctx.logger.getCode())}`
    );
    return evaluateStatement(node.consequent, ctx);
  } else if (node.alternate) {
    ctx.logger.setNext(
      node.alternate.loc.start.line - 1,
      `Condition is FALSE → go to ELSE: ${firstLineOf(
        node.alternate,
        ctx.logger.getCode()
      )}`
    );
    return evaluateStatement(node.alternate, ctx);
  } else if (ctx.nextStatement) {
    ctx.logger.setNext(
      ctx.nextStatement.loc.start.line - 1,
      `Skip IF → continue to: ${firstLineOf(
        ctx.nextStatement,
        ctx.logger.getCode()
      )}`
    );
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
      ctx.logger.addFlow(
        `Result: ${test ? "TRUE → enter loop body" : "FALSE → exit loop"}`
      );

      if (!test) {
        ctx.logger.setNext(
          node.loc.end.line,
          `Exit FOR loop → ${firstLineOf(ctx.nextStatement, ctx.logger.getCode())}`
        );
        break;
      }
      ctx.logger.setNext(
        node.body.loc.start.line - 1,
        `Start loop iteration #${iteration}`
      );
    }

    const res = evaluateStatement(node.body, loopCtx);
    if (isBreakSignal(res)) {
      ctx.logger.setNext(
        node.loc.end.line, 
        `Break → exit FOR loop. Next: ${firstLineOf(ctx.nextStatement, ctx.logger.getCode())}`
      );
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
      ctx.logger.setNext(
        node.test.loc.start.line - 1,
        "Go to loop condition check"
      );
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

    logIfRealStatement(node.test, loopCtx);
    const test = safeEvaluate(node.test, loopCtx);

    ctx.logger.addExpressionEval(node.test, test);
    ctx.logger.addExpressionContext(node.test, "While Loop Condition");

    ctx.logger.addFlow("WHILE LOOP CHECK:");
    ctx.logger.addFlow(`Iteration #${iteration}`);
    ctx.logger.addFlow(
      `Result: ${test ? "TRUE → continue loop" : "FALSE → exit loop"}`
    );

    if (!test) {
      ctx.logger.setNext(
        node.loc.end.line, 
        `Exit WHILE loop → ${firstLineOf(ctx.nextStatement, ctx.logger.getCode())}`
      );
      break;
    }

    ctx.logger.setNext(
      node.body.loc.start.line - 1,
      "Enter WHILE body"
    );

    const res = evaluateStatement(node.body, loopCtx);
    if (isBreakSignal(res)) {
      ctx.logger.setNext(
        node.loc.end.line, 
        `Break → exit WHILE loop. Next: ${firstLineOf(ctx.nextStatement, ctx.logger.getCode())}`
      );
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

// ---------- EXPRESSIONS ----------

function evaluateExpression(node: any, ctx: EvalContext): any {
  if (!node) return;

  if (ctx.safe) {
    if (node.type === "AssignmentExpression") return undefined;
    if (node.type === "UpdateExpression") {
      if (node.argument.type === "Identifier") {
        return ctx.env.get(node.argument.name);
      }
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
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          return left / right;
        case "%":
          return left % right;
        case "===":
          return left === right;
        case "!==":
          return left !== right;
        case "==":
          return left == right;
        case "!=":
          return left != right;
        case ">":
          return left > right;
        case "<":
          return left < right;
        case ">=":
          return left >= right;
        case "<=":
          return left <= right;
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
      return node.elements.map((el: any) =>
        el ? evaluateExpression(el, ctx) : null
      );

    case "ObjectExpression": {
      const obj = createObject(Object.prototype as any);
      for (const prop of node.properties) {
        const key =
          prop.key.type === "Identifier"
            ? prop.key.name
            : evaluateExpression(prop.key, ctx);
        const value = evaluateExpression(prop.value, ctx);
        setProperty(obj, key, value);
      }
      return obj;
    }

    case "ThisExpression":
      return ctx.thisValue;

    default:
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

// ---------- FUNCTION / CLASS SUPPORT ----------

function createUserFunction(node: any, env: LexicalEnvironment): FunctionValue {
  const params = node.params ?? [];
  const body = node.body;

  const functionImplementation = function (this: FunctionValue, thisArg: any, args: any[]) {
    const funcName = node.id?.name || node.key?.name || "Function";
    const fnEnv = new LexEnv(
      funcName,
      "function",
      new EnvironmentRecord(),
      this.__env
    );

    let callThisValue = thisArg;
    if (node.type === "ArrowFunctionExpression") {
      callThisValue = this.__env.get("this");
    }

    this.__params.forEach((param: any, index: number) => {
      const name = param.name;
      fnEnv.record.createMutableBinding(name, "var", args[index], true);
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

    if (isReturnSignal(result)) {
      return result.value;
    }
    return this.__body.type !== "BlockStatement" ? result : undefined;
  };

  const fn = createFunction(env, params, body, functionImplementation);
  return fn;
}

function evalCallExpression(node: any, ctx: EvalContext): any {
  const calleeVal = evaluateExpression(node.callee, ctx);
  const args = node.arguments.map((arg: any) =>
    evaluateExpression(arg, ctx)
  );

  let thisArg: any;
  if (node.callee.type === "MemberExpression") {
    const { object } = evalMemberTarget(node.callee, ctx);
    thisArg = object;
  } else {
    thisArg = ctx.thisValue ?? undefined;
  }

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

    if (!fn.__ctx) {
      fn.__ctx = { logger: ctx.logger, stack: ctx.stack };
    }

    const result = fn.call(thisArg, args);
    if (isReturnSignal(result)) {
      return result.value;
    }
    return result;
  }

  throw new Error("Call of non-function value");
}

function evalNewExpression(node: any, ctx: EvalContext): any {
  const ctor = evaluateExpression(node.callee, ctx);
  const args = node.arguments.map((arg: any) =>
    evaluateExpression(arg, ctx)
  );

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

function createClassConstructor(
  node: any,
  ctx: EvalContext
): FunctionValue {
  const classBody = node.body;
  const ctorMethod = classBody.body.find((m: any) => m.kind === "constructor");

  const baseCtor = createUserFunction(
    ctorMethod ??
      ({
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

    if (!fn.__ctx) {
      fn.__ctx = { logger: ctx.logger, stack: ctx.stack };
    }

    const funcName = node.id?.name || "<constructor>";
    ctx.stack.push(funcName);
    const logger = fn.__ctx.logger as TimelineLogger;
    logger.setCurrentEnv(fn.__env);

    const result = fn.call(instance, args);

    ctx.stack.pop();
    logger.setCurrentEnv(ctx.env);

    if (isReturnSignal(result)) {
      if (typeof result.value === "object" && result.value !== null) {
        return result.value;
      }
    }
    return instance;
  };

  return baseCtor;
}

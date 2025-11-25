// src/engine/statements/evalDeclarations.ts
import { bindPattern } from '../patterns/evalDestructuring';
import { createClassConstructor } from './evalClass';
import type { EvalContext } from '../types';
import { evaluateExpression, evaluateBlockBody } from '../evaluator';
import { LexicalEnvironment, EnvironmentRecord } from '../environment';
import { createFunction, FunctionValue } from '../values';
import { hoistProgram } from '../hoist';
import { isReturnSignal } from '../signals';
import { getFirstMeaningfulStatement, displayHeader } from '../next-step';
import type { TimelineLogger } from '../timeline';


export function evalVariableDeclaration(node: any, ctx: EvalContext) {
  const kind: "var" | "let" | "const" = node.kind;
  for (const decl of node.declarations) {
    const pattern = decl.id;
    const value = decl.init ? evaluateExpression(decl.init, ctx) : undefined;
    bindPattern(pattern, value, ctx, kind);
  }
}

export function evalFunctionDeclaration(node: any, ctx: EvalContext) {
  const name = node.id.name;
  const fn = createUserFunction(node, ctx.env);
  ctx.env.record.initializeBinding(name, fn);
}

export function evalClassDeclaration(node: any, ctx: EvalContext) {
  const name = node.id.name;
  const cls = createClassConstructor(node, ctx);
  ctx.env.record.initializeBinding(name, cls);
}

export function createUserFunction(node: any, env: LexicalEnvironment): FunctionValue {
    const params = node.params ?? [];
    const body = node.body;
  
    const functionImplementation = function (this: FunctionValue, thisArg: any, args: any[]) {
      const funcName = node.id?.name || node.key?.name || "Function";
      const fnEnv = new LexicalEnvironment(funcName, "function", new EnvironmentRecord(), this.__env);
  
      let callThisValue = thisArg;
      if (node.type === "ArrowFunctionExpression") {
        callThisValue = this.__env.get("this");
      }
  
      this.__params.forEach((param: any, index: number) => {
        if(param.type === 'Identifier') {
          const name = param.name;
          fnEnv.record.createMutableBinding(name, "var", args[index], true);
        } else {
            // Handle destructuring in parameters
            bindPattern(param, args[index], { env: fnEnv } as EvalContext, 'let');
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
          logger.setNext(first.loc.start.line - 1, `Next Step → ${displayHeader(first, logger.getCode())}`);
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
  
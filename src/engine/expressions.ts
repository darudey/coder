// src/engine/expressions.ts
// Pure expression evaluator — no statement logic.
// This file is imported by evaluator.ts and next-step-helpers.ts.

import type { EvalContext } from "./types";
import {
  getProperty,
  setProperty,
  createUserFunction,
  createObject,
  isUserFunction,
} from "./values";

import {
  makeReturn,
  makeThrow,
  isReturnSignal,
  isThrowSignal,
} from "./signals";

//
// ──────────────────────────────────────────────
//   Helper: resolve MemberExpression target
// ──────────────────────────────────────────────
//
export function resolveMember(node: any, ctx: EvalContext) {
  const obj = evaluateExpression(node.object, ctx);

  let prop: any;
  if (node.computed) {
    prop = evaluateExpression(node.property, ctx);
  } else {
    prop = node.property.name;
  }

  return { obj, prop };
}

//
// ──────────────────────────────────────────────
//   MAIN evaluateExpression
// ──────────────────────────────────────────────
//
export function evaluateExpression(node: any, ctx: EvalContext): any {
  if (!node) return;

  // SAFE MODE: preview only (used for Next-Step prediction)
  if (ctx.safe) {
    switch (node.type) {
      case "Identifier": return ctx.env.get(node.name);
      case "Literal": return node.value;
      case "BinaryExpression": return undefined;
      case "LogicalExpression": return undefined;
      case "CallExpression": return "[Side Effect]";
      case "UpdateExpression":
        if (node.argument.type === 'Identifier') {
          return ctx.env.get(node.argument.name);
        }
        return undefined;
    }
  }

  switch (node.type) {

    // ──────────────────────────
    // Identifier
    // ──────────────────────────
    case "Identifier":
      return ctx.env.get(node.name);

    // ──────────────────────────
    // Literal
    // ──────────────────────────
    case "Literal":
      return node.value;

    // ──────────────────────────
    // Template Literal
    // ──────────────────────────
    case "TemplateLiteral": {
      let out = "";
      for (let i = 0; i < node.quasis.length; i++) {
        out += node.quasis[i].value.raw;
        if (node.expressions[i]) {
          const v = evaluateExpression(node.expressions[i], ctx);
          out += String(v);
        }
      }
      return out;
    }

    // ──────────────────────────
    // UnaryExpression (!, +, -, typeof, void, delete)
    // ──────────────────────────
    case "UnaryExpression": {
      const v = evaluateExpression(node.argument, ctx);
      switch (node.operator) {
        case "!": return !v;
        case "+": return +v;
        case "-": return -v;
        case "typeof":
            if (node.argument.type === "Identifier" && !ctx.env.hasBinding(node.argument.name)) {
                return "undefined";
            }
            return typeof v;
        case "void": return void v;
        case "delete":
          if (node.argument.type === "MemberExpression") {
            const { obj, prop } = resolveMember(node.argument, ctx);
            return delete obj[prop];
          }
          return false;
        default:
          throw new Error("Unsupported unary operator " + node.operator);
      }
    }

    // ──────────────────────────
    // BinaryExpression (+, -, %, <, instanceof, in, etc.)
    // ──────────────────────────
    case "BinaryExpression": {
      const left = evaluateExpression(node.left, ctx);
      const right = evaluateExpression(node.right, ctx);

      switch (node.operator) {
        case "+": return left + right;
        case "-": return left - right;
        case "*": return left * right;
        case "/": return left / right;
        case "%": return left % right;
        case "<": return left < right;
        case ">": return left > right;
        case "<=": return left <= right;
        case ">=": return left >= right;
        case "==": return left == right;
        case "!=": return left != right;
        case "===": return left === right;
        case "!==": return left !== right;
        case "in": return left in right;
        case "instanceof": return left instanceof right;
        default:
          throw new Error("Unsupported operator " + node.operator);
      }
    }

    // ──────────────────────────
    // LogicalExpression (&&, ||, ??)
    // ──────────────────────────
    case "LogicalExpression": {
      const left = evaluateExpression(node.left, ctx);

      switch (node.operator) {
        case "&&": return left && evaluateExpression(node.right, ctx);
        case "||": return left || evaluateExpression(node.right, ctx);
        case "??": return left ?? evaluateExpression(node.right, ctx);
        default:
          throw new Error("Unsupported logical operator " + node.operator);
      }
    }

    // ──────────────────────────
    // ConditionalExpression (ternary)
    // ──────────────────────────
    case "ConditionalExpression":
      return evaluateExpression(node.test, ctx)
        ? evaluateExpression(node.consequent, ctx)
        : evaluateExpression(node.alternate, ctx);

    // ──────────────────────────
    // AssignmentExpression (+=, ??=, &&=, ||=)
    // ──────────────────────────
    case "AssignmentExpression": {
      let target;

      if (node.left.type === "Identifier") {
        const name = node.left.name;
        const prior = ctx.env.get(name);

        switch (node.operator) {
          case "=":
            return ctx.env.set(name,
              evaluateExpression(node.right, ctx)
            );

          case "+=":
            return ctx.env.set(name, prior + evaluateExpression(node.right, ctx));
          
          case "-=":
            return ctx.env.set(name, prior - evaluateExpression(node.right, ctx));
            
          case "*=":
            return ctx.env.set(name, prior * evaluateExpression(node.right, ctx));

          case "/=":
            return ctx.env.set(name, prior / evaluateExpression(node.right, ctx));
          
          case "%=":
            return ctx.env.set(name, prior % evaluateExpression(node.right, ctx));

          case "??=":
            if (prior ?? false) return prior;
            return ctx.env.set(name, evaluateExpression(node.right, ctx));

          case "&&=":
            if (!prior) return prior;
            return ctx.env.set(name, evaluateExpression(node.right, ctx));

          case "||=":
            if (prior) return prior;
            return ctx.env.set(name, evaluateExpression(node.right, ctx));

          default:
            throw new Error("Unsupported assignment operator " + node.operator);
        }
      }

      // MemberExpression e.g. obj.x += 2
      if (node.left.type === "MemberExpression") {
        const { obj, prop } = resolveMember(node.left, ctx);
        const prior = obj[prop];

        switch (node.operator) {
          case "=":
            obj[prop] = evaluateExpression(node.right, ctx);
            return obj[prop];

          case "+=":
            obj[prop] = prior + evaluateExpression(node.right, ctx);
            return obj[prop];

          case "??=":
            if (prior ?? false) return prior;
            obj[prop] = evaluateExpression(node.right, ctx);
            return obj[prop];

          case "&&=":
            if (!prior) return prior;
            obj[prop] = evaluateExpression(node.right, ctx);
            return obj[prop];

          case "||=":
            if (prior) return prior;
            obj[prop] = evaluateExpression(node.right, ctx);
            return obj[prop];

          default:
            throw new Error("Unsupported assignment operator " + node.operator);
        }
      }

      throw new Error("Unsupported assignment target");
    }

    // ──────────────────────────
    // UpdateExpression (++, --)
    // ──────────────────────────
    case "UpdateExpression": {
      if (node.argument.type === 'Identifier') {
          const name = node.argument.name;
          const cur = ctx.env.get(name);
          const next = node.operator === "++" ? cur + 1 : cur - 1;
          ctx.env.set(name, next);
          return node.prefix ? next : cur;
      }
       if (node.argument.type === 'MemberExpression') {
        const { obj, prop } = resolveMember(node.argument, ctx);
        const cur = obj[prop];
        const next = node.operator === '++' ? cur + 1 : cur - 1;
        obj[prop] = next;
        return node.prefix ? next : cur;
      }
      throw new Error("Unsupported update target");
    }

    // ──────────────────────────
    // MemberExpression (obj[x], obj.x)
    // ──────────────────────────
    case "MemberExpression": {
      const { obj, prop } = resolveMember(node, ctx);
      // Optional chaining member access: obj?.prop
      if(node.optional && obj == null) {
          return undefined;
      }
      return getProperty(obj, prop);
    }
    
    // ──────────────────────────
    // Functions & 'this'
    // ──────────────────────────
    case "ArrowFunctionExpression":
    case "FunctionExpression":
        return createUserFunction(node, ctx.env);
        
    case "ThisExpression":
        return ctx.thisValue;

    // ──────────────────────────
    // Optional chaining: a?.b or fn?.()
    // ──────────────────────────
    case "ChainExpression": {
      return evaluateExpression(node.expression, ctx);
    }

    case "CallExpression": {
      let thisArg: any;
      let callee: any;

      if (node.callee.type === 'MemberExpression') {
        const { obj, prop } = resolveMember(node.callee, ctx);
        thisArg = obj;
        callee = getProperty(obj, prop);
      } else {
        callee = evaluateExpression(node.callee, ctx);
        thisArg = ctx.thisValue ?? undefined;
      }

      // Optional chaining call: fn?.()
      if (node.optional && callee == null) {
        return undefined;
      }

      const args = node.arguments.map((a: any) =>
        evaluateExpression(a, ctx)
      );

      // builtin console.log
      if (callee && callee.__builtin === "console.log") {
        ctx.logger.logOutput(...args);
        return undefined;
      }

      // native
      if (typeof callee === "function" && !isUserFunction(callee)) {
        return callee.apply(thisArg, args);
      }

      // user function (teaching engine)
      if (isUserFunction(callee)) {
        const fn = callee;
        if (!fn.__ctx) fn.__ctx = { logger: ctx.logger, stack: ctx.stack };
        const result = fn.call(thisArg, args);
        if (isReturnSignal(result)) return result.value;
        return result;
      }

      throw new Error("Call of non-function value");
    }

    // ──────────────────────────
    // NewExpression
    // ──────────────────────────
    case "NewExpression": {
      const ctor = evaluateExpression(node.callee, ctx);
      const args = node.arguments.map((a: any) =>
        evaluateExpression(a, ctx)
      );

      if (ctor && (ctor as any).construct) {
        return (ctor as any).construct(args);
      }

      if (typeof ctor === "function") {
        const inst = createObject((ctor as any).prototype || Object.prototype);
        const ret = ctor.apply(inst, args);
        return typeof ret === "object" && ret !== null ? ret : inst;
      }

      throw new Error("new operator used on non-constructible value");
    }
    
    // ──────────────────────────
    // Array and Object literals
    // ──────────────────────────
    case "ArrayExpression": {
        return node.elements.map((el: any) => el ? evaluateExpression(el, ctx) : null);
    }
    case "ObjectExpression": {
        const obj = createObject(Object.prototype as any);
        for(const prop of node.properties) {
            const key = prop.key.type === 'Identifier' ? prop.key.name : evaluateExpression(prop.key, ctx);
            const value = evaluateExpression(prop.value, ctx);
            setProperty(obj, key, value);
        }
        return obj;
    }

    default:
      return undefined;
  }
}

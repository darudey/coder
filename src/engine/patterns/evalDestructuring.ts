// src/engine/patterns/evalDestructuring.ts
import { resolveMember, evaluateExpression } from '../expressions';
import { setProperty } from '../values';
import type { EvalContext } from '../types';

function assignToLValue(node: any, value: any, ctx: EvalContext) {
  if (node.type === "Identifier") {
    ctx.env.set(node.name, value);
  } else if (node.type === "MemberExpression") {
    const { obj, prop } = resolveMember(node, ctx);
    setProperty(obj, prop, value);
  } else {
    throw new Error("Unsupported assignment target in pattern");
  }
}

function bindObjectPattern(pattern: any, obj: any, ctx: EvalContext, kind: "var" | "let" | "const") {
    if (obj == null) obj = {}; // safe fallback for null / undefined

    for (const prop of pattern.properties) {
        // Rest: {...rest}
        if (prop.type === "RestElement") {
            const rest: Record<string, any> = {};
            const usedKeys = new Set(
                pattern.properties
                .filter((p: any) => p.type === "Property")
                .map((p: any) => p.key?.name)
                .filter(Boolean)
            );
            for (const k of Object.keys(obj)) {
                if (!usedKeys.has(k)) {
                    rest[k] = obj[k];
                }
            }
            bindPattern(prop.argument, rest, ctx, kind);
            continue;
        }

        // Normal property
        const key = prop.key.name;
        const value = obj[key];

        bindPattern(prop.value, value, ctx, kind);
    }
}

function bindArrayPattern(pattern: any, arr: any, ctx: EvalContext, kind: "var" | "let" | "const") {
    if (!Array.isArray(arr)) arr = []; // safe fallback

    for (let i = 0; i < pattern.elements.length; i++) {
        const element = pattern.elements[i];

        if (!element) continue; // skip holes like [a,,c]

        if (element.type === "RestElement") {
            const rest = arr.slice(i);
            bindPattern(element.argument, rest, ctx, kind);
            return; // Rest element must be last
        }

        const value = arr[i];
        bindPattern(element, value, ctx, kind);
    }
}

export function bindPattern(
  pattern: any,
  value: any,
  ctx: EvalContext,
  kind: "var" | "let" | "const"
) {
  if (!pattern) return;

  switch (pattern.type) {
    case "Identifier": {
      const name = pattern.name;
      if (kind === "var") {
        ctx.env.set(name, value);
      } else {
        ctx.env.record.createMutableBinding(name, kind, value, true);
      }
      break;
    }

    case "AssignmentPattern": {
        // pattern.left is the real binding target
        // pattern.right is the default value expression
        let finalValue = value;

        // If value is undefined → use default initializer
        if (finalValue === undefined) {
            finalValue = evaluateExpression(pattern.right, ctx);
        }

        return bindPattern(pattern.left, finalValue, ctx, kind);
    }

    case "ObjectPattern": {
      bindObjectPattern(pattern, value, ctx, kind);
      break;
    }

    case "ArrayPattern": {
      bindArrayPattern(pattern, value, ctx, kind);
      break;
    }

    case "RestElement": {
        // This is handled inside Object/Array pattern binders, but can be a safety net.
        const restName = pattern.argument.name;
        if (kind === 'var') {
            ctx.env.set(restName, value);
        } else {
            ctx.env.record.createMutableBinding(restName, kind, value, true);
        }
        break;
    }

    default:
      throw new Error(`Unsupported binding pattern: ${pattern.type}`);
  }
}

export function assignPattern(pattern: any, value: any, ctx: EvalContext) {
  if (!pattern) return;

  switch (pattern.type) {
    case "Identifier":
    case "MemberExpression": {
      assignToLValue(pattern, value, ctx);
      break;
    }
    
    case "AssignmentPattern": {
        let finalValue = value;
        if (finalValue === undefined) {
            finalValue = evaluateExpression(pattern.right, ctx);
        }
        return assignPattern(pattern.left, finalValue, ctx);
    }

    case "ObjectPattern": {
      const obj = value ?? {};
      for (const prop of pattern.properties) {
        if (prop.type === "RestElement") {
            const restObj: any = {};
            const usedKeys = new Set(
                pattern.properties
                .filter((p: any) => p.type === "Property")
                .map((p: any) => p.key?.name)
                .filter(Boolean)
            );
            for (const k of Object.keys(obj)) {
                if (!usedKeys.has(k)) restObj[k] = (obj as any)[k];
            }
            assignPattern(prop.argument, restObj, ctx);
            continue;
        }

        const key = prop.key.type === "Identifier"
              ? prop.key.name
              : evaluateExpression(prop.key, ctx);
        const subValue = (obj as any)[key];
        assignPattern(prop.value, subValue, ctx);
      }
      break;
    }

    case "ArrayPattern": {
      const arr = Array.isArray(value) ? value : [];
      let idx = 0;
      for (const element of pattern.elements) {
        if (!element) {
          idx++;
          continue;
        }
        if (element.type === "RestElement") {
          const rest = arr.slice(idx);
          assignPattern(element.argument, rest, ctx);
          break;
        } else {
          assignPattern(element, arr[idx], ctx);
          idx++;
        }
      }
      break;
    }

    default:
      throw new Error(`Unsupported assignment pattern: ${pattern.type}`);
  }
}

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

    case "ObjectPattern": {
      const obj = value ?? {};
      for (const prop of pattern.properties) {
        if (prop.type === "Property") {
          const key =
            prop.key.type === "Identifier"
              ? prop.key.name
              : evaluateExpression(prop.key, ctx);
          const subValue = (obj as any)[key];
          bindPattern(prop.value, subValue, ctx, kind);
        } else if (prop.type === "RestElement") {
          const restObj: any = {};
          const usedKeys = new Set(
            pattern.properties
              .filter((p: any) => p.type === "Property")
              .map((p: any) =>
                p.key.type === "Identifier" ? p.key.name : null
              )
              .filter(Boolean)
          );
          for (const k of Object.keys(obj)) {
            if (!usedKeys.has(k)) restObj[k] = (obj as any)[k];
          }
          bindPattern(prop.argument, restObj, ctx, kind);
        }
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
          bindPattern(element.argument, rest, ctx, kind);
          break;
        } else {
          bindPattern(element, arr[idx], ctx, kind);
          idx++;
        }
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

    case "ObjectPattern": {
      const obj = value ?? {};
      for (const prop of pattern.properties) {
        if (prop.type === "Property") {
          const key =
            prop.key.type === "Identifier"
              ? prop.key.name
              : evaluateExpression(prop.key, ctx);
          const subValue = (obj as any)[key];
          assignPattern(prop.value, subValue, ctx);
        } else if (prop.type === "RestElement") {
          const restObj: any = {};
          const usedKeys = new Set(
            pattern.properties
              .filter((p: any) => p.type === "Property")
              .map((p: any) =>
                p.key.type === "Identifier" ? p.key.name : null
              )
              .filter(Boolean)
          );
          for (const k of Object.keys(obj)) {
            if (!usedKeys.has(k)) restObj[k] = (obj as any)[k];
          }
          assignPattern(prop.argument, restObj, ctx);
        }
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


export function formatForFlow(value: any): string {
  if (value === null || value === undefined) return String(value);

  const t = typeof value;

  if (t === "string") return JSON.stringify(value);
  if (t === "number" || t === "boolean") return String(value);

  if (t === "function") return "[NativeFunction]";
  if (value && value.__isFunctionValue) return "[Function]";

  if (Array.isArray(value)) return `[Array(${value.length})]`;

  return "[Object]";
}

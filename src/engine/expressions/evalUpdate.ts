
// PATCH: ++x, x++, --x, x--
import type { EvalContext } from "../types";

export function evalUpdate(node: any, ctx: EvalContext) {
    const arg = node.argument;
    if (arg.type !== "Identifier") {
      throw new Error("Update target must be an identifier");
    }

    const name = arg.name;
    const oldVal = ctx.env.get(name);
    const newVal = node.operator === "++" ? oldVal + 1 : oldVal - 1;

    ctx.logger.addFlow(
        `Update: ${name} ${node.operator}  (old = ${oldVal}, new = ${newVal})`
    );

    ctx.logger.addExpressionEval(node, newVal, [
        `${name} was ${oldVal}`,
        `${node.operator} → ${newVal}`,
    ]);

    ctx.env.set(name, newVal);
    return node.prefix ? newVal : oldVal;
}

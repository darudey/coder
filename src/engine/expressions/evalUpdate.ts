
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

    // --- PATCH ---
    // Update the environment *before* logging the step,
    // so the timeline shows the *new* value in the scope.
    ctx.env.set(name, newVal);
    
    // Log this as its own step.
    ctx.logger.log(node.loc.start.line - 1);
    // --- END PATCH ---

    ctx.logger.addFlow(
        `Update: ${name} ${node.operator}  (old = ${oldVal}, new = ${newVal})`
    );

    ctx.logger.addExpressionEval(node, node.prefix ? newVal : oldVal, [
        `${name} was ${oldVal}`,
        `${node.operator} → ${newVal}`,
    ]);
    
    return node.prefix ? newVal : oldVal;
}

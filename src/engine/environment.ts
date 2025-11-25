// src/engine/environment.ts

export type EnvKind = "global" | "function" | "block";

interface Binding {
  kind: "var" | "let" | "const" | "function" | "class";
  value: any;
}

export class EnvironmentRecord {
  private bindings = new Map<string, Binding>();

  hasBinding(name: string): boolean {
    return this.bindings.has(name);
  }

  createMutableBinding(
    name: string,
    kind: Binding["kind"],
    value: any,
    _deletable: boolean
  ) {
    if (this.bindings.has(name)) {
      // Over-simplified: real JS would behave differently for some kinds.
      return;
    }
    this.bindings.set(name, { kind, value });
  }

  initializeBinding(name: string, value: any) {
    const binding = this.bindings.get(name);
    if (!binding) {
      // This can happen with function hoisting where the binding is created
      // but not yet initialized with the function value.
      this.bindings.set(name, { kind: 'function', value });
      return;
    }
    binding.value = value;
  }

  setMutableBinding(name: string, value: any) {
    const binding = this.bindings.get(name);
    if (!binding) {
      throw new Error(`Binding ${name} not found for setMutableBinding`);
    }
    if (binding.kind === 'const') {
        throw new TypeError('Assignment to constant variable.');
    }
    binding.value = value;
  }

  getBindingValue(name: string): any {
    const binding = this.bindings.get(name);
    if (!binding) {
      // This should ideally not be hit if hasBinding is checked first.
      throw new Error(`Binding ${name} not found for getBindingValue`);
    }
    return binding.value;
  }

  snapshot(): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [name, binding] of this.bindings.entries()) {
      out[name] = binding.value;
    }
    return out;
  }
}

export class LexicalEnvironment {
  public record: EnvironmentRecord;
  public outer: LexicalEnvironment | null;
  public kind: EnvKind;
  public name: string;

  constructor(
    name: string,
    kind: EnvKind,
    record?: EnvironmentRecord,
    outer?: LexicalEnvironment | null
  ) {
    this.name = name;
    this.kind = kind;
    this.record = record ?? new EnvironmentRecord();
    this.outer = outer ?? null;
  }
  
  static newGlobal(): LexicalEnvironment {
    return new LexicalEnvironment("Global", 'global', new EnvironmentRecord(), null);
  }

  extend(kind: EnvKind, name = ""): LexicalEnvironment {
    const envName = name || (kind === "block" ? "Block" : "Function");
    return new LexicalEnvironment(envName, kind, new EnvironmentRecord(), this);
  }

  hasBinding(name: string): boolean {
    if (this.record.hasBinding(name)) return true;
    return this.outer ? this.outer.hasBinding(name) : false;
  }

  createMutableBinding(
    name: string,
    kind: Binding["kind"],
    value: any,
    deletable: boolean
  ) {
    this.record.createMutableBinding(name, kind, value, deletable);
  }

  initializeBinding(name: string, value: any) {
    this.record.initializeBinding(name, value);
  }

  set(name: string, value: any) {
    if (this.record.hasBinding(name)) {
      this.record.setMutableBinding(name, value);
      return;
    }
    if (this.outer) {
      this.outer.set(name, value);
      return;
    }
    // If not found, create at global level (teaching simplification)
    this.record.createMutableBinding(name, "var", value, true);
  }

  get(name: string): any {
    if (this.record.hasBinding(name)) {
      return this.record.getBindingValue(name);
    }
    if (this.outer) {
      return this.outer.get(name);
    }
    throw new Error(`ReferenceError: ${name} is not defined`);
  }

  snapshotChain(): Record<string, any> {
    const result: Record<string, any> = {};
    let current: LexicalEnvironment | null = this;
    let funcIndex = 1;
    let blockIndex = 1;

    while (current) {
      const snapshot = current.record.snapshot();
      if (Object.keys(snapshot).length > 0) {
        let label = current.name;
        if (current.kind === "global") {
            label = "Global";
        } else if (current.kind === 'function') {
            label = current.name || `Function#${funcIndex++}`;
        } else if (current.kind === 'block') {
            if(result[`Block#${blockIndex}`]) {
                // Merge with existing block if there are nested blocks
                 result[`Block#${blockIndex}`] = {...snapshot, ...result[`Block#${blockIndex}`]};
                 current = current.outer;
                 continue;
            }
            label = `Block#${blockIndex++}`;
        }
        result[label] = snapshot;
      }

      current = current.outer;
    }

    return result;
  }
}

// src/engine/environment.ts

export type BindingKind = "var" | "let" | "const" | "function" | "class";

export interface BindingRecord {
  value: any;
  mutable: boolean;
  initialized: boolean;
  kind: BindingKind;
}

export class EnvironmentRecord {
  private bindings = new Map<string, BindingRecord>();

  hasBinding(name: string): boolean {
    return this.bindings.has(name);
  }

  createMutableBinding(name: string, kind: BindingKind, value: any = undefined, initialized = false) {
    if (this.bindings.has(name)) {
      // shadowing allowed in inner environments, but not same record (for simplicity)
      // in real spec it's more nuanced, but this is good enough
      throw new Error(`Identifier '${name}' has already been declared in this scope`);
    }
    const mutable = kind !== "const";
    this.bindings.set(name, { value, mutable, initialized, kind });
  }

  initializeBinding(name: string, value: any) {
    const rec = this.bindings.get(name);
    if (!rec) throw new Error(`Cannot initialize undeclared binding '${name}'`);
    rec.value = value;
    rec.initialized = true;
  }

  setMutableBinding(name: string, value: any) {
    const rec = this.bindings.get(name);
    if (!rec) throw new Error(`Assignment to undeclared variable '${name}'`);
    if (!rec.initialized) {
      throw new Error(`ReferenceError: Cannot access '${name}' before initialization`);
    }
    if (!rec.mutable) {
      throw new Error(`TypeError: Assignment to constant variable '${name}'`);
    }
    rec.value = value;
  }

  getBindingValue(name: string): any {
    const rec = this.bindings.get(name);
    if (!rec) throw new Error(`ReferenceError: ${name} is not defined`);
    if (!rec.initialized) {
      throw new Error(`ReferenceError: Cannot access '${name}' before initialization`);
    }
    return rec.value;
  }

  snapshot(): Record<string, any> {
    const obj: Record<string, any> = {};
    for (const [name, rec] of this.bindings.entries()) {
      if (!rec.initialized) continue;
      obj[name] = rec.value;
    }
    return obj;
  }
}

export class LexicalEnvironment {
  constructor(
    public name: string,
    public record: EnvironmentRecord,
    public outer: LexicalEnvironment | null
  ) {}

  static newGlobal(): LexicalEnvironment {
    return new LexicalEnvironment("Global", new EnvironmentRecord(), null);
  }

  extend(name: string): LexicalEnvironment {
    return new LexicalEnvironment(name, new EnvironmentRecord(), this);
  }

  hasBinding(name: string): boolean {
    let env: LexicalEnvironment | null = this;
    while (env) {
      if (env.record.hasBinding(name)) return true;
      env = env.outer;
    }
    return false;
  }

  get(name: string): any {
    let env: LexicalEnvironment | null = this;
    while (env) {
      if (env.record.hasBinding(name)) {
        return env.record.getBindingValue(name);
      }
      env = env.outer;
    }
    throw new Error(`ReferenceError: ${name} is not defined`);
  }

  set(name: string, value: any): void {
    let env: LexicalEnvironment | null = this;
    while (env) {
      if (env.record.hasBinding(name)) {
        env.record.setMutableBinding(name, value);
        return;
      }
      env = env.outer;
    }
    // non-strict mode var-like behavior: assign to global
    this.record.createMutableBinding(name, "var", value, true);
  }

  snapshotChain(): Record<string, any> {
    const result: Record<string, any> = {};
    let env: LexicalEnvironment | null = this;
    let i = 0;
    while (env) {
      const snapshot = env.record.snapshot();
      if (Object.keys(snapshot).length > 0) {
        let name = env.name;
        // Avoid duplicate names like "Block", "Block", "Block"
        if(result[name]) {
            name = `${name} ${i}`;
        }
        result[name] = snapshot;
      }
      env = env.outer;
      i++;
    }
    return result;
  }
}

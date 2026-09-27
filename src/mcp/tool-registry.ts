export interface RuntimeToolDefinition {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

class RuntimeToolRegistry {
  private definitions = new Map<string, RuntimeToolDefinition>();
  private inactive = new Set<string>();

  register(name: string, description: string, schema: Record<string, unknown>): void {
    if (this.definitions.has(name)) throw new Error(`Duplicate MCP tool registration: ${name}`);
    this.definitions.set(name, { name, description, schema });
  }

  clear(): void {
    this.definitions.clear();
    this.inactive.clear();
  }

  names(): string[] {
    return [...this.definitions.keys()].sort();
  }

  has(name: string): boolean {
    return this.definitions.has(name) && !this.inactive.has(name);
  }

  setActive(name: string, active: boolean): void {
    if (active) this.inactive.delete(name);
    else this.inactive.add(name);
  }

  activeNames(): string[] {
    return this.names().filter((name) => !this.inactive.has(name));
  }

  snapshot(): RuntimeToolDefinition[] {
    return [...this.definitions.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}

/** Canonical registry populated by the same calls that register runtime tools. */
export const runtimeToolRegistry = new RuntimeToolRegistry();

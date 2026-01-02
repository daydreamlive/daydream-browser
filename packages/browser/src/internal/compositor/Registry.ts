import type { Source } from "../../types";

export type RegistryEntry = {
  id: string;
  source: Source;
  registeredAt: number;
};

export type RegistryEvents = {
  onRegister?: (id: string, source: Source) => void;
  onUnregister?: (id: string) => void;
};

export interface SourceRegistry {
  register(id: string, source: Source): void;
  unregister(id: string): Source | undefined;
  get(id: string): Source | undefined;
  has(id: string): boolean;
  list(): Array<{ id: string; source: Source }>;
  clear(): void;
}

export function createRegistry(events?: RegistryEvents): SourceRegistry {
  const sources = new Map<string, RegistryEntry>();

  return {
    register(id: string, source: Source): void {
      if (!id) throw new Error("Source id is required");
      if (!source) throw new Error("Source is required");

      sources.set(id, {
        id,
        source,
        registeredAt: Date.now(),
      });

      events?.onRegister?.(id, source);
    },

    unregister(id: string): Source | undefined {
      const entry = sources.get(id);
      if (!entry) return undefined;

      sources.delete(id);
      events?.onUnregister?.(id);

      return entry.source;
    },

    get(id: string): Source | undefined {
      return sources.get(id)?.source;
    },

    has(id: string): boolean {
      return sources.has(id);
    },

    list(): Array<{ id: string; source: Source }> {
      return Array.from(sources.values()).map((entry) => ({
        id: entry.id,
        source: entry.source,
      }));
    },

    clear(): void {
      const ids = Array.from(sources.keys());
      sources.clear();
      ids.forEach((id) => events?.onUnregister?.(id));
    },
  };
}

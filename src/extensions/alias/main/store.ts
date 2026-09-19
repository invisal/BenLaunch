/**
 * Persists per-action aliases (the Ctrl+K menu's "Alias" row — see
 * `renderer/context-menu.tsx`) via an `ExtensionStorage` document, the same
 * mechanism `HotkeyBindingStore` uses. Not an `Extension` subclass itself,
 * since it doesn't contribute search rows — it just fills in `keyword` on any
 * action's search match (see `query()` in `main/actions.ts`). The one alias
 * store for every action, quicklinks included — see
 * `QuicklinkSource.useAliases`.
 */
import type { ExtensionStorage } from "@core/storage";

const KEY = "aliases";

export class AliasStore {
  private readonly storage: ExtensionStorage;

  constructor(storage: ExtensionStorage) {
    this.storage = storage;
  }

  /** actionId -> alias. Always a fresh shallow copy — see `HotkeyBindingStore.list`. */
  list(): Record<string, string> {
    return { ...(this.storage.get<Record<string, string>>(KEY) ?? {}) };
  }

  get(actionId: string): string | undefined {
    return this.list()[actionId];
  }

  set(actionId: string, alias: string): void {
    this.storage.set(KEY, { ...this.list(), [actionId]: alias });
  }

  remove(actionId: string): void {
    const aliases = this.list();
    delete aliases[actionId];
    this.storage.set(KEY, aliases);
  }
}

/**
 * Persists per-action global hotkey bindings (`Set Hotkey…` in the Ctrl+K
 * menu — see `renderer/context-menu.ts`) via an `ExtensionStorage` document,
 * the same mechanism every other extension uses for its own item collection
 * — this module just isn't an `Extension` subclass itself, since it doesn't
 * contribute search rows. `storage` is constructor-injected (see
 * `main/actions.ts`) rather than self-constructed, so `node --test` can hand
 * it a temp-dir instance directly — mirrors `WidgetStore`/
 * `CalculatorHistoryStore`.
 */
import type { ExtensionStorage } from "@core/storage";
import type { ActionHotkeyBinding } from "../shared/types";

const KEY = "bindings";

/**
 * Seeded once, the first time this store is ever created (an empty/missing
 * file) — not re-applied on every load, so a user who explicitly removes the
 * default doesn't have it come back on the next launch. macOS's own
 * Preferences shortcut is Cmd+, — Ctrl+, is the nearest cross-platform analog
 * (VS Code, Slack, …), and Ctrl+, isn't claimed by anything else here.
 */
function defaultBindings(): Record<string, ActionHotkeyBinding> {
  return {
    "cmd:settings": {
      accelerator: process.platform === "darwin" ? "Command+," : "Ctrl+,",
      type: "command",
    },
  };
}

export class HotkeyBindingStore {
  private readonly storage: ExtensionStorage;

  constructor(storage: ExtensionStorage) {
    this.storage = storage;
  }

  /**
   * actionId -> binding. Seeds the built-in defaults on first-ever read.
   * Always a fresh shallow copy — `ExtensionStorage.get` hands back its own
   * internal object, and a caller mutating it in place would corrupt
   * in-memory state without persisting.
   */
  list(): Record<string, ActionHotkeyBinding> {
    const existing = this.storage.get<Record<string, ActionHotkeyBinding>>(KEY);
    if (existing !== undefined) return { ...existing };
    const seeded = defaultBindings();
    this.storage.set(KEY, seeded);
    return { ...seeded };
  }

  get(actionId: string): ActionHotkeyBinding | undefined {
    return this.list()[actionId];
  }

  set(actionId: string, binding: ActionHotkeyBinding): void {
    this.storage.set(KEY, { ...this.list(), [actionId]: binding });
  }

  remove(actionId: string): void {
    const bindings = { ...this.list() };
    delete bindings[actionId];
    this.storage.set(KEY, bindings);
  }
}

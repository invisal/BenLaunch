/**
 * Persisted calculator history, newest first.
 *
 * Persistence goes through the extension's `ExtensionStorage` (injected by
 * `CalculatorHistoryExtension`), under the `entries` key of
 * `<userData>/extensions/calculator-history.json`. This class keeps the domain
 * rules — dedupe by query, the size cap, the pin cap — and stays Electron-free
 * so the `node --test` suite can drive it directly.
 */
import { randomUUID } from "node:crypto";
import type { ExtensionStorage } from "@core/storage";
import type { HistoryEntry, RecordInput } from "../shared/types";

/** Storage key holding the `HistoryEntry[]`. */
const KEY = "entries";

/** Unpinned entries kept; the oldest beyond this are dropped. */
export const MAX_ENTRIES = 500;

/** Pinned entries allowed at once. Pins never count toward `MAX_ENTRIES`. */
export const MAX_PINNED = 10;

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<HistoryEntry>;
  return (
    typeof c.id === "string" &&
    typeof c.query === "string" &&
    typeof c.expression === "string" &&
    typeof c.value === "string" &&
    typeof c.rawValue === "string" &&
    typeof c.createdAt === "number" &&
    typeof c.pinned === "boolean"
  );
}

/** Same query modulo case and spacing — `"1+1"` typed twice is one entry. */
function queryKey(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

export class HistoryStore {
  private readonly storage: ExtensionStorage;
  private readonly now: () => number;

  /** Newest first. */
  private items: HistoryEntry[] = [];
  private loaded = false;

  constructor(storage: ExtensionStorage, now: () => number = Date.now) {
    this.storage = storage;
    this.now = now;
  }

  /** Load the stored list. Missing / malformed entries are dropped individually. */
  init(): void {
    if (this.loaded) return;
    this.loaded = true;
    const raw = this.storage.get<unknown>(KEY);
    if (Array.isArray(raw)) {
      this.items = raw
        .filter(isHistoryEntry)
        .sort((a, b) => b.createdAt - a.createdAt);
    }
  }

  /** Pinned entries first, then everything else; newest first within each. */
  list(): HistoryEntry[] {
    this.init();
    const pinned = this.items.filter((e) => e.pinned);
    const rest = this.items.filter((e) => !e.pinned);
    return [...pinned, ...rest].map((e) => ({ ...e }));
  }

  get(id: string): HistoryEntry | undefined {
    this.init();
    const found = this.items.find((e) => e.id === id);
    return found ? { ...found } : undefined;
  }

  /** Pinned entries, newest first. */
  pinned(): HistoryEntry[] {
    return this.list().filter((e) => e.pinned);
  }

  /**
   * Record a calculation the user acted on. Recording a query that's already
   * in history refreshes that entry (new result, moved to the top, pin kept)
   * instead of adding a duplicate. Returns the stored entry.
   */
  record(input: RecordInput): HistoryEntry | undefined {
    this.init();
    const query = input.query.trim();
    if (!query || !input.value) return undefined;

    const key = queryKey(query);
    const existing = this.items.find((e) => queryKey(e.query) === key);
    const entry: HistoryEntry = {
      id: existing?.id ?? randomUUID(),
      query,
      expression: input.expression,
      value: input.value,
      rawValue: input.rawValue,
      createdAt: this.now(),
      pinned: existing?.pinned ?? false,
    };

    this.items = [entry, ...this.items.filter((e) => e !== existing)];
    this.trim();
    this.persist();
    return { ...entry };
  }

  /**
   * Store a newer result for an entry without moving it — a pinned row's live
   * refresh. No-op (and no disk write) when nothing changed.
   */
  updateResult(id: string, value: string, rawValue: string): void {
    this.init();
    const entry = this.items.find((e) => e.id === id);
    if (!entry || (entry.value === value && entry.rawValue === rawValue))
      return;
    entry.value = value;
    entry.rawValue = rawValue;
    this.persist();
  }

  /**
   * Pin or unpin. Returns `false` when pinning would exceed `MAX_PINNED` (or
   * the id is unknown) — the entry is left unchanged.
   */
  setPinned(id: string, pinned: boolean): boolean {
    this.init();
    const entry = this.items.find((e) => e.id === id);
    if (!entry) return false;
    if (entry.pinned === pinned) return true;
    if (pinned && this.items.filter((e) => e.pinned).length >= MAX_PINNED) {
      return false;
    }
    entry.pinned = pinned;
    this.trim();
    this.persist();
    return true;
  }

  remove(id: string): void {
    this.init();
    const next = this.items.filter((e) => e.id !== id);
    if (next.length === this.items.length) return;
    this.items = next;
    this.persist();
  }

  /** Drop every unpinned entry — pins survive a clear. */
  clear(): void {
    this.init();
    const next = this.items.filter((e) => e.pinned);
    if (next.length === this.items.length) return;
    this.items = next;
    this.persist();
  }

  /** Drop the oldest unpinned entries beyond `MAX_ENTRIES`. */
  private trim(): void {
    let unpinned = 0;
    this.items = this.items.filter((e) => {
      if (e.pinned) return true;
      unpinned += 1;
      return unpinned <= MAX_ENTRIES;
    });
  }

  private persist(): void {
    this.storage.set(KEY, this.items);
  }
}

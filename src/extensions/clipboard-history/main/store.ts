/**
 * Persisted clipboard history, newest first.
 *
 * Persistence goes through the extension's `ExtensionStorage` (injected by
 * `ClipboardHistoryExtension`), under the `entries` key of
 * `<userData>/extensions/clipboard-history.json`. This class keeps the domain
 * rules — the per-type size caps, the pin cap — and stays Electron-free so
 * the `node --test` suite can drive it directly.
 *
 * Captured text/images may include sensitive data (passwords, tokens copied
 * from a password manager). Raycast lets you exclude specific apps by bundle
 * id; this codebase can identify the copying app on macOS only (see
 * `sourceApp` on `ClipboardEntry`, resolved in `main/source-app-mac.ts`) and
 * has nothing to build that on for Windows/Linux, so per-app exclusion
 * itself is still out of scope here.
 */
import { randomUUID } from "node:crypto";
import type { ExtensionStorage } from "@core/storage";
import { imagePreview, makePreview } from "../shared/format.ts";
import type { ClipboardEntry, RecordInput } from "../shared/types";

/** Storage key holding the `ClipboardEntry[]`. */
const KEY = "entries";

/** Unpinned text entries kept; the oldest beyond this are dropped. */
export const MAX_TEXT_ENTRIES = 300;

/** Unpinned image entries kept — much heavier than text, so a tighter cap. */
export const MAX_IMAGE_ENTRIES = 30;

/** Pinned entries allowed at once, across both content types. Pins never count toward either cap above. */
export const MAX_PINNED = 25;

function isClipboardEntry(value: unknown): value is ClipboardEntry {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<ClipboardEntry>;
  if (
    typeof c.id !== "string" ||
    typeof c.preview !== "string" ||
    typeof c.createdAt !== "number" ||
    typeof c.pinned !== "boolean"
  )
    return false;
  if (c.contentType === "text") return typeof c.text === "string";
  if (c.contentType === "image") return typeof c.imageDataUrl === "string";
  return false;
}

export class ClipboardStore {
  private readonly storage: ExtensionStorage;
  private readonly now: () => number;

  /** Newest first. */
  private items: ClipboardEntry[] = [];
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
        .filter(isClipboardEntry)
        .sort((a, b) => b.createdAt - a.createdAt);
    }
  }

  /** Pinned entries first, then everything else; newest first within each. */
  list(): ClipboardEntry[] {
    this.init();
    const pinned = this.items.filter((e) => e.pinned);
    const rest = this.items.filter((e) => !e.pinned);
    return [...pinned, ...rest].map((e) => ({ ...e }));
  }

  get(id: string): ClipboardEntry | undefined {
    this.init();
    const found = this.items.find((e) => e.id === id);
    return found ? { ...found } : undefined;
  }

  /**
   * Record a new clipboard item. Always creates a new entry — copying the
   * same text again later isn't deduped, matching Raycast's actual
   * behaviour. Ignores blank/whitespace-only text. Returns the stored entry.
   */
  record(input: RecordInput): ClipboardEntry | undefined {
    this.init();

    let entry: ClipboardEntry;
    if (input.contentType === "text") {
      const text = input.text.trim();
      if (!text) return undefined;
      entry = {
        id: randomUUID(),
        contentType: "text",
        text,
        // Optional fields are only *set* when actually present — an
        // explicit `undefined` value survives in memory but `JSON.stringify`
        // drops it on persist, so a `record()`'d entry and the same entry
        // reloaded from disk would otherwise differ structurally even
        // though they mean the same thing.
        ...(input.sourceApp ? { sourceApp: input.sourceApp } : {}),
        preview: makePreview(text),
        createdAt: this.now(),
        pinned: false,
      };
    } else {
      entry = {
        id: randomUUID(),
        contentType: "image",
        imageDataUrl: input.dataUrl,
        imageSize: { width: input.width, height: input.height },
        originalBytes: input.originalBytes,
        ...(input.sourcePath ? { sourcePath: input.sourcePath } : {}),
        ...(input.sourceApp ? { sourceApp: input.sourceApp } : {}),
        preview: imagePreview(input.width, input.height),
        createdAt: this.now(),
        pinned: false,
      };
    }

    this.items = [entry, ...this.items];
    // `record()` can now run after an `await` (resolving the source app), so
    // two overlapping calls aren't guaranteed to finish — and prepend — in
    // the order the underlying copies actually happened. Sorting by each
    // entry's own `createdAt` keeps display order correct regardless of
    // which one's lookup was slower.
    this.items.sort((a, b) => b.createdAt - a.createdAt);
    this.trim();
    this.persist();
    return { ...entry };
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

  /** Drop the oldest unpinned entries beyond each content type's cap. */
  private trim(): void {
    let unpinnedText = 0;
    let unpinnedImages = 0;
    this.items = this.items.filter((e) => {
      if (e.pinned) return true;
      if (e.contentType === "text") {
        unpinnedText += 1;
        return unpinnedText <= MAX_TEXT_ENTRIES;
      }
      unpinnedImages += 1;
      return unpinnedImages <= MAX_IMAGE_ENTRIES;
    });
  }

  private persist(): void {
    this.storage.set(KEY, this.items);
  }
}

/**
 * Persisted recognitions, newest first.
 *
 * Persistence goes through the extension's `ExtensionStorage` (injected by
 * `TextFromImageExtension`), under the `recognitions` key of
 * `<userData>/extensions/text-from-image.json`. This class keeps the domain
 * rules — the entry cap, the pin cap, pins never being evicted — and stays
 * Electron-free so the `node --test` suite can drive it directly.
 *
 * Only the *thumbnail* is kept, never the source image's full bytes: a
 * recognized page's value is its text, and storing full-resolution
 * screenshots would grow the document without bound. A recognition made from
 * a file therefore keeps that file's path (so "Reveal in Finder/Explorer"
 * works), while one made from the clipboard keeps nothing but its preview.
 *
 * Recognized text can be as sensitive as what was on screen when it was
 * captured — the same caveat Clipboard History carries in its own store.
 */
import { randomUUID } from "node:crypto";
import type { ExtensionStorage } from "@core/storage";
import { makePreview } from "../shared/format.ts";
import type { ImageSource, OcrLine, Recognition } from "../shared/types";

/** Storage key holding the `Recognition[]`. */
const KEY = "recognitions";

/** Unpinned recognitions kept; the oldest beyond this are dropped. */
export const MAX_ENTRIES = 100;

/** Pinned recognitions allowed at once. Pins never count toward `MAX_ENTRIES`. */
export const MAX_PINNED = 20;

/** What `record()` is handed — the store assigns `id`/`createdAt`/`preview`/`pinned`. */
export interface RecordInput {
  source: ImageSource;
  thumbnailDataUrl: string;
  imageSize: { width: number; height: number };
  engine: Recognition["engine"];
  language: string;
  lines: OcrLine[];
  confidence: number | null;
  durationMs: number;
}

function isRecognition(value: unknown): value is Recognition {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<Recognition>;
  return (
    typeof entry.id === "string" &&
    typeof entry.createdAt === "number" &&
    typeof entry.preview === "string" &&
    typeof entry.pinned === "boolean" &&
    Array.isArray(entry.lines) &&
    typeof entry.thumbnailDataUrl === "string"
  );
}

export class RecognitionStore {
  private readonly storage: ExtensionStorage;
  private readonly now: () => number;

  /** Newest first. */
  private items: Recognition[] = [];
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
        .filter(isRecognition)
        .sort((a, b) => b.createdAt - a.createdAt);
    }
  }

  /** Pinned first, then everything else; newest first within each. */
  list(): Recognition[] {
    this.init();
    return [
      ...this.items.filter((entry) => entry.pinned),
      ...this.items.filter((entry) => !entry.pinned),
    ].map((entry) => ({ ...entry }));
  }

  get(id: string): Recognition | undefined {
    this.init();
    const found = this.items.find((entry) => entry.id === id);
    return found ? { ...found } : undefined;
  }

  /** Store a new recognition and return it. */
  record(input: RecordInput): Recognition {
    this.init();
    const entry: Recognition = {
      id: randomUUID(),
      createdAt: this.now(),
      preview: makePreview(input.lines),
      pinned: false,
      ...input,
    };
    this.items.unshift(entry);
    this.trim();
    this.persist();
    return { ...entry };
  }

  remove(id: string): void {
    this.init();
    const next = this.items.filter((entry) => entry.id !== id);
    if (next.length === this.items.length) return;
    this.items = next;
    this.persist();
  }

  /** Drop every unpinned recognition. */
  clear(): void {
    this.init();
    const next = this.items.filter((entry) => entry.pinned);
    if (next.length === this.items.length) return;
    this.items = next;
    this.persist();
  }

  /** `false` when pinning would exceed `MAX_PINNED` — the caller surfaces that. */
  setPinned(id: string, pinned: boolean): boolean {
    this.init();
    const entry = this.items.find((item) => item.id === id);
    if (!entry) return false;
    if (pinned && !entry.pinned) {
      const count = this.items.filter((item) => item.pinned).length;
      if (count >= MAX_PINNED) return false;
    }
    entry.pinned = pinned;
    this.persist();
    return true;
  }

  /** Drop the oldest unpinned entries past `MAX_ENTRIES`. Pins are never evicted. */
  private trim(): void {
    const unpinned = this.items.filter((entry) => !entry.pinned);
    if (unpinned.length <= MAX_ENTRIES) return;
    const doomed = new Set(
      unpinned.slice(MAX_ENTRIES).map((entry) => entry.id),
    );
    this.items = this.items.filter((entry) => !doomed.has(entry.id));
  }

  private persist(): void {
    this.storage.set(KEY, this.items);
  }
}

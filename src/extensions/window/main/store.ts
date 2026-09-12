/**
 * Persisted list of user-authored custom window layouts ("Create Command").
 *
 * Persistence goes through the window extension's `ExtensionStorage`
 * (injected by `WindowExtension`), under the `layouts` key of
 * `<userData>/extensions/window.json`. This class keeps the domain logic —
 * slugging, id collisions, partial updates — and stays Electron-free so the
 * `node --test` suite can drive it directly.
 */
import type { ExtensionStorage } from "@core/storage";
import type {
  AnchorPosition,
  CustomLayoutDef,
  CustomLayoutDraft,
} from "../shared/types";

/** Storage key holding the `CustomLayoutDef[]`. */
const KEY = "layouts";

const ANCHOR_POSITIONS: readonly AnchorPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

function isAnchorPosition(value: unknown): value is AnchorPosition {
  return (
    typeof value === "string" && (ANCHOR_POSITIONS as string[]).includes(value)
  );
}

function isCustomLayoutDef(value: unknown): value is CustomLayoutDef {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CustomLayoutDef>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    isAnchorPosition(candidate.position) &&
    (candidate.widthPercent === null ||
      typeof candidate.widthPercent === "number") &&
    (candidate.heightPercent === null ||
      typeof candidate.heightPercent === "number") &&
    typeof candidate.offsetXPercent === "number" &&
    typeof candidate.offsetYPoints === "number" &&
    typeof candidate.useGap === "boolean"
  );
}

/** `name` → url-safe slug. Empty / all-punctuation names fall back to `layout`. */
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "layout";
}

export class WindowLayoutStore {
  private readonly storage: ExtensionStorage;

  private items: CustomLayoutDef[] = [];
  private loaded = false;

  constructor(storage: ExtensionStorage) {
    this.storage = storage;
  }

  /** Load the stored list into memory. Missing / malformed → empty list. */
  init(): void {
    if (this.loaded) return;
    this.loaded = true;
    const raw = this.storage.get<unknown>(KEY);
    if (Array.isArray(raw) && raw.every(isCustomLayoutDef)) {
      this.items = raw as CustomLayoutDef[];
    }
  }

  list(): CustomLayoutDef[] {
    this.init();
    return this.items.map((item) => ({ ...item }));
  }

  get(id: string): CustomLayoutDef | undefined {
    this.init();
    const found = this.items.find((item) => item.id === id);
    return found ? { ...found } : undefined;
  }

  /**
   * Create (no `id`) or update (`id` present) a custom layout and persist.
   * Returns the saved definition, including the generated id on create.
   */
  save(draft: CustomLayoutDraft): CustomLayoutDef {
    this.init();

    if (draft.id) {
      const existing = this.items.find((item) => item.id === draft.id);
      if (existing) {
        existing.name = draft.name;
        existing.position = draft.position;
        existing.widthPercent = draft.widthPercent;
        existing.heightPercent = draft.heightPercent;
        existing.offsetXPercent = draft.offsetXPercent;
        existing.offsetYPoints = draft.offsetYPoints;
        existing.useGap = draft.useGap;
        this.persist();
        return { ...existing };
      }
    }

    const def: CustomLayoutDef = {
      ...draft,
      id: this.uniqueId(slugify(draft.name)),
    };
    this.items.push(def);
    this.persist();
    return { ...def };
  }

  remove(id: string): void {
    this.init();
    const next = this.items.filter((item) => item.id !== id);
    if (next.length === this.items.length) return;
    this.items = next;
    this.persist();
  }

  /** `base`, or `base-2`, `base-3`, … if taken. */
  private uniqueId(base: string): string {
    if (!this.items.some((item) => item.id === base)) return base;
    for (let n = 2; ; n++) {
      const candidate = `${base}-${n}`;
      if (!this.items.some((item) => item.id === candidate)) return candidate;
    }
  }

  private persist(): void {
    this.storage.set(KEY, this.items);
  }
}

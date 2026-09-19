/**
 * Persisted list of user-defined Groups (a name + the ids of the action-source
 * items it bundles). Persistence goes through the Group extension's
 * `ExtensionStorage` (injected by `GroupExtension`), under the `groups` key of
 * `<userData>/extensions/group.json`. This class keeps the domain logic —
 * slugging, id collisions, partial updates — and stays Electron-free so the
 * `node --test` suite can drive it directly.
 */
import type { ExtensionStorage } from "@core/storage";
import type { GroupDef, GroupDraft } from "../shared/types";

/** Storage key holding the `GroupDef[]`. */
const KEY = "groups";

function isGroupDef(value: unknown): value is GroupDef {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GroupDef>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    Array.isArray(candidate.sourceIds) &&
    candidate.sourceIds.every((id) => typeof id === "string")
  );
}

/** `name` → url-safe slug. Empty / all-punctuation names fall back to `group`. */
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "group";
}

export class GroupStore {
  private readonly storage: ExtensionStorage;

  private items: GroupDef[] = [];
  private loaded = false;

  constructor(storage: ExtensionStorage) {
    this.storage = storage;
  }

  /** Load the stored list into memory. Missing / malformed → empty list. */
  init(): void {
    if (this.loaded) return;
    this.loaded = true;
    const raw = this.storage.get<unknown>(KEY);
    if (Array.isArray(raw) && raw.every(isGroupDef)) {
      this.items = raw as GroupDef[];
    }
  }

  list(): GroupDef[] {
    this.init();
    return this.items.map((item) => ({
      ...item,
      sourceIds: [...item.sourceIds],
    }));
  }

  get(id: string): GroupDef | undefined {
    this.init();
    const found = this.items.find((item) => item.id === id);
    return found ? { ...found, sourceIds: [...found.sourceIds] } : undefined;
  }

  /**
   * Create (no `id`) or update (`id` present) a Group and persist. Returns
   * the saved definition, including the generated id on create.
   */
  save(draft: GroupDraft): GroupDef {
    this.init();

    if (draft.id) {
      const existing = this.items.find((item) => item.id === draft.id);
      if (existing) {
        existing.name = draft.name;
        existing.sourceIds = [...draft.sourceIds];
        this.persist();
        return { ...existing, sourceIds: [...existing.sourceIds] };
      }
    }

    const def: GroupDef = {
      id: this.uniqueId(slugify(draft.name)),
      name: draft.name,
      sourceIds: [...draft.sourceIds],
    };
    this.items.push(def);
    this.persist();
    return { ...def, sourceIds: [...def.sourceIds] };
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

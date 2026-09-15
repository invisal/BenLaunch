/**
 * Group's wire contract — the DTOs and IPC channel names shared by the
 * extension's main handlers (`../ipc/handlers.ts`), its preload fragment
 * (`../ipc/preload.ts`) and the manager renderer (`../renderer/`).
 */

/** A user-defined Group: a named bundle of other actions' ids. */
export interface GroupDef {
  /** Stable slug, derived from `name` on creation. */
  id: string;
  name: string;
  /** Ids of the action-source items this group bundles together. */
  sourceIds: string[];
}

/** A Group draft on its way in from the manager form (no id yet when creating). */
export interface GroupDraft {
  id?: string;
  name: string;
  sourceIds: string[];
}

/** IPC channels for the Group manager screen ↔ main. */
export const GROUP_CHANNELS = {
  list: "group:list",
  get: "group:get",
  save: "group:save",
  delete: "group:delete",
  /** Resolve a group's `sourceIds` into the other sources' current `LauncherAction`s. */
  items: "group:items",
} as const;

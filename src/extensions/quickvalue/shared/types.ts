/**
 * QuickValue's wire contract — the DTOs and IPC channel names shared by the
 * extension's main handlers (`../ipc/handlers.ts`), its preload fragment
 * (`../ipc/preload.ts`) and the manager renderer (`../renderer/`).
 */

/** A user-authored QuickValue definition. Crosses IPC to the manage window. */
export interface QuickValueDef {
  /** Stable slug, derived from `name` on creation; used in the action id `qv:<id>`. */
  id: string;
  name: string;
  /** Optional free-text note shown in the manager. Empty is stored as absent. */
  description?: string;
  code: string;
  exposed: boolean;
}

/** A QuickValue draft on its way in from the editor (no id yet when creating). */
export interface QuickValueDraft {
  id?: string;
  name: string;
  description?: string;
  /**
   * Omit on an update to keep the stored code untouched — the metadata screen
   * (name / description / exposed) and the code window save independently, so
   * neither should overwrite the other's field. Required in practice on create.
   */
  code?: string;
  exposed: boolean;
}

/** One-shot run result, for the editor's "Test" button. */
export type QuickValueTestResult =
  | { ok: true; value: string | number | null }
  | { ok: false; error: string };

/** IPC channels for the QuickValue manager window ↔ main. */
export const QUICKVALUE_CHANNELS = {
  list: "quickvalue:list",
  get: "quickvalue:get",
  save: "quickvalue:save",
  delete: "quickvalue:delete",
  setExposed: "quickvalue:set-exposed",
  test: "quickvalue:test",
  /** main → launcher window: an exposed QuickValue's value changed. */
  update: "quickvalue:update",
} as const;

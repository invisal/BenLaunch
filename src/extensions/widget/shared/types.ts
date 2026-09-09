/**
 * Widget's wire contract — the DTOs and IPC channel names shared by the
 * extension's main handlers (`../ipc/handlers.ts`), its preload fragment
 * (`../ipc/preload.ts`) and the manager renderer (`../renderer/`).
 */

/** A user-authored Widget definition. Crosses IPC to the manage window. */
export interface WidgetDef {
  /** Stable slug, derived from `name` on creation; used in the action id `widget:<id>`. */
  id: string;
  name: string;
  /** Optional free-text note shown in the manager. Empty is stored as absent. */
  description?: string;
  code: string;
  exposed: boolean;
}

/** A Widget draft on its way in from the editor (no id yet when creating). */
export interface WidgetDraft {
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
export type WidgetTestResult =
  | { ok: true; value: string | number | null }
  | { ok: false; error: string };

/** IPC channels for the Widget manager window ↔ main. */
export const WIDGET_CHANNELS = {
  list: "widget:list",
  get: "widget:get",
  save: "widget:save",
  delete: "widget:delete",
  setExposed: "widget:set-exposed",
  test: "widget:test",
  /** main → launcher window: an exposed Widget's value changed. */
  update: "widget:update",
} as const;

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
  /** Emoji or an inlined `data:` image URI (uploaded icons are resized to
   *  ICON_SIZE px first). Absent means the default glyph. */
  icon?: string;
  code: string;
  exposed: boolean;
}

/** Edge length, in px, uploaded icons are resized to before being stored. */
export const ICON_SIZE = 64;

/** The glyph a Widget shows when it has no icon of its own. */
export const DEFAULT_WIDGET_ICON = "⚡";

/** A Widget draft on its way in from the editor (no id yet when creating). */
export interface WidgetDraft {
  id?: string;
  name: string;
  description?: string;
  icon?: string;
  /**
   * Omit on an update to keep the stored code untouched — the metadata screen
   * (name / description / exposed) and the code window save independently, so
   * neither should overwrite the other's field. Required in practice on create.
   */
  code?: string;
  exposed: boolean;
}

/** One-shot run result, for the editor's "Test" button. */
export type WidgetTestResult = (
  { ok: true; value: string | number | null } | { ok: false; error: string }
) & {
  /** `console.*` output from the run, in order. Absent when nothing was logged. */
  logs?: string[];
};

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

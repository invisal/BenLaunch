/** Where a custom layout's rect anchors within the work area, before its offset is applied. */
export type AnchorPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/**
 * A user-authored custom window layout, on its way in from the editor (no id
 * yet when creating). `widthPercent`/`heightPercent` of `null` means "Auto" —
 * keep whatever size the target window already is on that axis.
 */
export interface CustomLayoutDraft {
  id?: string;
  name: string;
  position: AnchorPosition;
  widthPercent: number | null;
  heightPercent: number | null;
  /** Offset from `position`'s anchor point, as a percent of the work area's width. */
  offsetXPercent: number;
  /** Offset from `position`'s anchor point, in points (not scaled by display size). */
  offsetYPoints: number;
  /** Whether to inset the result by the user's preferred gap (see `getGapSize`). */
  useGap: boolean;
}

/** A saved custom layout. Crosses IPC to the manager screens and into search as `win:custom:<id>`. */
export interface CustomLayoutDef extends CustomLayoutDraft {
  id: string;
}

/** The work-area size + platform label of the display the launcher is on, for the create-command preview to scale against. */
export interface DisplayPreviewInfo {
  width: number;
  height: number;
  label: string;
}

/** IPC channel names for the window-management extension (OS-level control + custom-layout manager). */
export const WINDOW_CHANNELS = {
  customLayoutList: "window:custom-layout-list",
  customLayoutGet: "window:custom-layout-get",
  customLayoutSave: "window:custom-layout-save",
  customLayoutDelete: "window:custom-layout-delete",
  /** Work-area size + label of the display the *calling window* is on, for the create-command preview to scale against. */
  displayInfo: "window:display-info",
  gapSize: "window:gap-size",
  setGapSize: "window:set-gap-size",
  accessibilityStatus: "window:accessibility-status",
  requestAccessibility: "window:request-accessibility",
} as const;

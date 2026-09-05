export type LauncherActionType = "application" | "command" | "quickvalue";

export interface LauncherAction {
  id: string;
  title: string;
  subtitle?: string;
  /** Emoji, single/few characters, or an image URL (http(s):/data:/file:) */
  icon?: string;
  type: LauncherActionType;
  /** Electron accelerator string, e.g. "CommandOrControl+1" */
  shortcut?: string;
  /**
   * The action is resolving a value in the background (e.g. a QuickValue running
   * its async function). The list shows a spinner instead of the subtitle.
   */
  isLoading?: boolean;
  /**
   * The subtitle isn't computed up front — it needs an IPC round-trip to fetch
   * (e.g. a QuickValue's cached/live value). The renderer requests it only once
   * the row actually renders (virtualization keeps this lazy: off-screen rows
   * never fire the request), rather than the action source computing it eagerly
   * for every row on every `provide()`.
   */
  isDeferredSubtitle?: boolean;
}

/** A user-authored QuickValue definition. Crosses IPC to the manage window. */
export interface QuickValueDef {
  /** Stable slug, derived from `name` on creation; used in the action id `qv:<id>`. */
  id: string;
  name: string;
  code: string;
  exposed: boolean;
}

/** A QuickValue draft on its way in from the editor (no id yet when creating). */
export interface QuickValueDraft {
  id?: string;
  name: string;
  code: string;
  exposed: boolean;
}

/** One-shot run result, for the editor's "Test" button. */
export type QuickValueTestResult =
  | { ok: true; value: string | number | null }
  | { ok: false; error: string };

/** Options for `requestSubtitle`. `force` bypasses any staleness cache (e.g. "Refresh"). */
export interface RequestSubtitleOptions {
  force?: boolean;
}

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

/** A saved custom layout. Crosses IPC to the manage window and into search as `win:custom:<id>`. */
export interface CustomLayoutDef extends CustomLayoutDraft {
  id: string;
}

/** The primary display's work-area size + a human label, for the create-command preview to scale against. */
export interface DisplayPreviewInfo {
  width: number;
  height: number;
  label: string;
}

/** One run of an expression, classified for syntax highlighting. */
export type CalcTokenKind =
  | "number"
  | "operator"
  | "paren"
  | "function"
  | "constant"
  | "unit"
  | "punct"
  | "whitespace";

export interface CalcToken {
  text: string;
  kind: CalcTokenKind;
}

/** An evaluated expression the query itself resolved to (e.g. `"1 + 2"` → `"3"`). */
export interface Calculation {
  /** The normalized expression — spoken forms rewritten to symbols, trimmed. */
  expression: string;
  /** The formatted result, ready to display or copy. */
  value: string;
  /** The result without grouping separators, for pasting into code / feeding back in. */
  rawValue: string;
  /** `expression` split for syntax highlighting; absent when it could not be tokenized. */
  tokens?: CalcToken[];
  /** Small print shown bottom-right of the result — e.g. currency's "Updated 2 days ago". */
  footnote?: string;
}

/** What a query resolves to: the ranked actions, plus an optional inline answer. */
export interface QueryResult {
  result: LauncherAction[];
  calculation?: Calculation;
}

export const IPC_CHANNELS = {
  query: "launcher:query",
  execute: "launcher:execute",
  hide: "launcher:hide",
  togglePin: "launcher:toggle-pin",
  accessibilityStatus: "window:accessibility-status",
  requestAccessibility: "window:request-accessibility",
  /** launcher → main: a deferred-subtitle row (`isDeferredSubtitle`) rendered
   *  (or asked to force-refresh); whichever source owns it resolves with the
   *  fresh subtitle. Not QuickValue-specific — there is no separate push
   *  channel, the resolved value IS the update. */
  requestSubtitle: "launcher:request-subtitle",
  quickValueList: "quickvalue:list",
  quickValueGet: "quickvalue:get",
  quickValueSave: "quickvalue:save",
  quickValueDelete: "quickvalue:delete",
  quickValueSetExposed: "quickvalue:set-exposed",
  quickValueTest: "quickvalue:test",
  customLayoutList: "window:custom-layout-list",
  customLayoutGet: "window:custom-layout-get",
  customLayoutSave: "window:custom-layout-save",
  customLayoutDelete: "window:custom-layout-delete",
  /** The primary display's work-area size, for the create-command preview to scale against. */
  displayInfo: "window:display-info",
  gapSize: "window:gap-size",
  setGapSize: "window:set-gap-size",
} as const;

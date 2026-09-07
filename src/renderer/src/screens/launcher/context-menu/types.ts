import type { LauncherAction } from "@shared/types";
import type { OpenWithApp } from "@shared/quicklink";

/**
 * One entry in the Ctrl+K "Actions" menu. Consumed by `ActionsMenu`, produced by
 * the context-menu contributors (`./registry`). A bare leaf has an `onSelect`; an
 * item with a `submenu` drills in instead; `confirmLabel` guards a destructive
 * leaf with a second activation.
 */
export interface MenuActionItem {
  id: string;
  label: string;
  shortcut?: string;
  /** Emoji or image URL shown before the label (used by the "Open With" apps). */
  icon?: string;
  /** Render in a warning colour (Delete Quicklink). */
  danger?: boolean;
  /**
   * Group heading. A heading is drawn above the first item of each run of items
   * that share a `section`; items with no `section` get no heading. Keep items
   * of one section contiguous in the array.
   */
  section?: string;
  /** Leaf action. Omitted when the item only opens a `submenu`. */
  onSelect?: () => void;
  /** When present, selecting the item drills into this nested list instead. */
  submenu?: MenuActionItem[];
  /**
   * Destructive leaf action guarded by a second activation: the first
   * activation just swaps the label to this text (arming it); a second
   * activation within a few seconds runs `onSelect`.
   */
  confirmLabel?: string;
}

/** The launcher form open on top of the search view, if any. Owned by `App`. */
export type Editor =
  | { mode: "create" }
  | { mode: "edit"; id: string }
  | { mode: "duplicate"; id: string };

/**
 * Renderer-local capabilities a contributor can trigger from a menu item's
 * `onSelect`. Everything a contributor needs that isn't already reachable via
 * `window.api` lives here, so contributors stay plain modules with no imports
 * from `App` and no main-process dependencies.
 */
export interface ContextMenuContext {
  /** The text in the search box right now (query-driven actions parse their argument out of it). */
  query: string;
  /** Whether the launcher is currently pinned — for the Pin/Unpin label. */
  pinned: boolean;
  /** Installed apps, for the quicklink "Open With…" submenu. */
  apps: OpenWithApp[];
  setQuery(value: string): void;
  openEditor(editor: Editor): void;
  /** Re-run the current query (after pin/hide/delete changes the list). */
  reload(): void;
  /** Close the menu and dismiss the launcher (unless pinned). */
  dismiss(): void;
  /** Toggle the launcher pin, keeping `App`'s `pinned` state in sync. */
  togglePin(): void;
  /** Tell the row's `SearchItem` to re-fetch its deferred subtitle. */
  forceRefresh(actionId: string): void;
  /** Run an action the way pressing Enter on its row would. */
  runAction(action: LauncherAction): void;
}

/**
 * What a contributor offers for one highlighted action:
 *  - `null` — abstain; the next contributor is tried.
 *  - `MenuActionItem[]` — "augment": append these, keep going down the chain.
 *  - `{ role: "primary", actions }` — the main block. The first primary wins;
 *    later primaries (including the default one) are skipped.
 */
export type Contribution =
  | null
  | MenuActionItem[]
  | { role: "primary"; actions: MenuActionItem[] };

/** A module that contributes items to the Ctrl+K menu for some kinds of action. */
export interface ContextMenuContributor {
  /** Stable id, for debugging; not required to be unique across `MenuActionItem` ids. */
  id: string;
  contribute(action: LauncherAction, ctx: ContextMenuContext): Contribution;
}

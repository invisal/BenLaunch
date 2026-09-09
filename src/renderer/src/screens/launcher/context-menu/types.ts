import type { LauncherAction } from "@shared/types";
import type { OpenWithApp } from "@shared/quicklink";
import type { FooterMenuItem } from "@renderer/shared/ui";
import type { Route } from "../router/types";

/**
 * One entry in the Ctrl+K "Actions" menu, produced by the context-menu
 * contributors (`./registry`) and rendered by the shared `Footer.Menu` — a
 * flat, searchable list. It's exactly a `FooterMenuItem`: a leaf with an
 * `onSelect`, optionally carrying an `icon`, a `section` heading, `danger`
 * styling, or a `confirmLabel` (arm-then-confirm). No nesting — a group of
 * related actions is a `section`, not a submenu.
 */
export type MenuActionItem = FooterMenuItem;

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
  /** Installed apps, for the quicklink "Open With" menu rows. */
  apps: OpenWithApp[];
  setQuery(value: string): void;
  /** Push a screen onto the launcher's navigation stack (e.g. the Create Quicklink form). */
  push(route: Route): void;
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

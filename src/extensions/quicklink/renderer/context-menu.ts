import type { LauncherAction } from "@shared/types";
import type {
  ContextMenuContext,
  ContextMenuContributor,
} from "@renderer/screens/launcher/context-menu/types";
import {
  createQuicklinkItem,
  quicklinkMenuItems,
  type QuicklinkMenuHost,
} from "./menu-items";

/** The launcher's side of `QuicklinkMenuHost` — the rows themselves live in `./menu-items`. */
function host(
  action: LauncherAction,
  ctx: ContextMenuContext,
): QuicklinkMenuHost {
  return {
    apps: ctx.apps,
    query: ctx.query,
    push: ctx.push,
    reload: ctx.reload,
    dismiss: ctx.dismiss,
    open: () => ctx.runAction(action),
  };
}

/**
 * Owns the Ctrl+K menu for quicklink rows (`ql:*`), and adds a single "Create
 * Quicklink" item to every other kind of row except Widgets and pinned
 * calculations (whose menus are only about the value, not about making links).
 *
 * The rows themselves come from `./menu-items`, shared with the "Search
 * Quicklinks" manager screen so the two surfaces can't drift apart.
 */
export const quicklinkContextMenu: ContextMenuContributor = {
  id: "quicklink",
  contribute(action: LauncherAction, ctx: ContextMenuContext) {
    const isQuicklink =
      action.type === "quicklink" && action.id.startsWith("ql:");

    if (!isQuicklink) {
      if (action.type === "widget" || action.type === "calculation")
        return null;
      return [createQuicklinkItem(host(action, ctx))];
    }

    return {
      role: "primary" as const,
      actions: quicklinkMenuItems(
        {
          id: action.id.slice(3),
          name: action.title,
          pinned: action.pinned,
          hidden: action.hidden,
        },
        host(action, ctx),
      ),
    };
  },
};

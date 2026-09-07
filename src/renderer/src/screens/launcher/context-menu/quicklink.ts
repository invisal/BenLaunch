import type { LauncherAction } from "@shared/types";
import type { ContextMenuContext, ContextMenuContributor, MenuActionItem } from "./types";

/** The "Open With…" submenu: the system default plus every resolved app. */
function openWithItem(actionId: string, ctx: ContextMenuContext): MenuActionItem {
  return {
    id: "open-with",
    label: "Open With…",
    submenu: [
      {
        id: "ow:__default",
        label: "Default App",
        onSelect: () => {
          void window.api.openQuicklinkWith(actionId, ctx.query, "");
          ctx.dismiss();
        },
      },
      ...ctx.apps.map((app) => ({
        id: `ow:${app.path}`,
        label: app.name,
        icon: app.icon,
        onSelect: () => {
          void window.api.openQuicklinkWith(actionId, ctx.query, app.path);
          ctx.dismiss();
        },
      })),
    ],
  };
}

/**
 * Owns the Ctrl+K menu for quicklink rows (`ql:*`), and adds a single "Create
 * Quicklink" item to every other kind of row except QuickValues (whose menu is
 * only about the value, not about making links).
 */
export const quicklinkContextMenu: ContextMenuContributor = {
  id: "quicklink",
  contribute(action: LauncherAction, ctx: ContextMenuContext) {
    const isQuicklink = action.type === "quicklink" && action.id.startsWith("ql:");

    if (!isQuicklink) {
      if (action.type === "quickvalue") return null;
      return [
        {
          id: "create-quicklink",
          label: "Create Quicklink",
          section: "Quicklink",
          onSelect: () => ctx.openEditor({ mode: "create" }),
        },
      ];
    }

    const actionId = action.id;
    const id = actionId.slice(3);
    const isPinned = !!action.pinned;
    const isHidden = !!action.hidden;

    return {
      role: "primary" as const,
      actions: [
        {
          id: "run",
          label: "Open Quicklink",
          shortcut: "Enter",
          onSelect: () => ctx.runAction(action),
        },
        openWithItem(actionId, ctx),
        {
          id: "pin",
          section: "Manage Quicklink",
          label: isPinned ? "Unpin Quicklink" : "Pin Quicklink",
          onSelect: async () => {
            await window.api.setQuicklinkPinned(id, !isPinned);
            ctx.reload();
          },
        },
        {
          id: "edit",
          section: "Manage Quicklink",
          label: "Edit Quicklink",
          onSelect: () => ctx.openEditor({ mode: "edit", id }),
        },
        {
          id: "duplicate",
          section: "Manage Quicklink",
          label: "Duplicate Quicklink",
          onSelect: () => ctx.openEditor({ mode: "duplicate", id }),
        },
        {
          id: "hide",
          section: "Manage Quicklink",
          label: isHidden ? "Show in Root Search" : "Hide in Root Search",
          onSelect: async () => {
            await window.api.setQuicklinkHidden(id, !isHidden);
            ctx.reload();
          },
        },
        {
          id: "copy-name",
          section: "Copy",
          label: "Copy Name",
          shortcut: "CommandOrControl+C",
          onSelect: () => void navigator.clipboard.writeText(action.title),
        },
        {
          id: "copy-link",
          section: "Copy",
          label: "Copy Link",
          onSelect: async () => {
            const ql = await window.api.getQuicklink(id);
            if (ql) await navigator.clipboard.writeText(ql.link);
          },
        },
        {
          id: "create-quicklink",
          section: "Quicklink",
          label: "Create Quicklink",
          onSelect: () => ctx.openEditor({ mode: "create" }),
        },
        {
          id: "delete",
          section: "Danger Zone",
          label: "Delete Quicklink",
          confirmLabel: `Click again to delete "${action.title}"`,
          danger: true,
          onSelect: async () => {
            await window.api.deleteQuicklink(id);
            ctx.reload();
          },
        },
      ],
    };
  },
};

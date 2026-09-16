import type { LauncherAction } from "@shared/types";
import type {
  ContextMenuContext,
  ContextMenuContributor,
  MenuActionItem,
} from "@renderer/screens/launcher/context-menu/types";
import type { OpenWithApp } from "../shared/types";

/**
 * The "Open With" row: a submenu holding the system default plus every
 * resolved app. It's a list of its own rather than a `section` inlined into
 * the menu because `ctx.apps` is every installed app that can take a path as
 * an argument — on Windows, every Start-Menu shortcut resolving to an `.exe`,
 * which inline would bury Pin/Edit/Delete under a hundred rows.
 */
function openWithItem(
  actionId: string,
  ctx: ContextMenuContext,
): MenuActionItem {
  // The system default is the empty path — the same "no override" the IPC call
  // already takes — so it's just the first app in the list, not its own row.
  const apps: OpenWithApp[] = [{ name: "Default App", path: "" }, ...ctx.apps];
  return {
    id: "open-with",
    label: "Open With",
    items: apps.map((app) => ({
      id: `ow:${app.path || "__default"}`,
      label: app.name,
      icon: app.icon,
      onSelect: () => {
        void window.api.quicklink.openQuicklinkWith(
          actionId,
          ctx.query,
          app.path,
        );
        ctx.dismiss();
      },
    })),
  };
}

/**
 * Owns the Ctrl+K menu for quicklink rows (`ql:*`), and adds a single "Create
 * Quicklink" item to every other kind of row except Widgets and pinned
 * calculations (whose menus are only about the value, not about making links).
 */
export const quicklinkContextMenu: ContextMenuContributor = {
  id: "quicklink",
  contribute(action: LauncherAction, ctx: ContextMenuContext) {
    const isQuicklink =
      action.type === "quicklink" && action.id.startsWith("ql:");

    if (!isQuicklink) {
      if (action.type === "widget" || action.type === "calculation")
        return null;
      return [
        {
          id: "create-quicklink",
          label: "Create Quicklink",
          section: "Quicklink",
          onSelect: () =>
            ctx.push({
              name: "quicklink-create",
              payload: { seed: ctx.query },
            }),
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
            await window.api.quicklink.setQuicklinkPinned(id, !isPinned);
            ctx.reload();
          },
        },
        {
          id: "edit",
          section: "Manage Quicklink",
          label: "Edit Quicklink",
          onSelect: () => ctx.push({ name: "quicklink-edit", payload: { id } }),
        },
        {
          id: "duplicate",
          section: "Manage Quicklink",
          label: "Duplicate Quicklink",
          onSelect: () =>
            ctx.push({ name: "quicklink-duplicate", payload: { id } }),
        },
        {
          id: "hide",
          section: "Manage Quicklink",
          label: isHidden ? "Show in Root Search" : "Hide in Root Search",
          onSelect: async () => {
            await window.api.quicklink.setQuicklinkHidden(id, !isHidden);
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
            const ql = await window.api.quicklink.getQuicklink(id);
            if (ql) await navigator.clipboard.writeText(ql.link);
          },
        },
        {
          id: "create-quicklink",
          section: "Quicklink",
          label: "Create Quicklink",
          onSelect: () =>
            ctx.push({
              name: "quicklink-create",
              payload: { seed: ctx.query },
            }),
        },
        {
          id: "delete",
          section: "Danger Zone",
          label: "Delete Quicklink",
          confirmLabel: `Click again to delete "${action.title}"`,
          danger: true,
          onSelect: async () => {
            await window.api.quicklink.deleteQuicklink(id);
            ctx.reload();
          },
        },
      ],
    };
  },
};

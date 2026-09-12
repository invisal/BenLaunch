import type { LauncherAction } from "@shared/types";
import type { ContextMenuContributor } from "@renderer/screens/launcher/context-menu/types";

/** Matches `CUSTOM_LAYOUT_PREFIX` in `main/source.ts`. */
const CUSTOM_LAYOUT_PREFIX = "win:custom:";

/**
 * Owns the Ctrl+K menu for saved custom window layouts (`win:custom:*`).
 *
 * These rows are `type: "command"`, exactly like the built-in window-management
 * and launcher commands, so the id prefix is the only thing that tells them
 * apart — matching on `type` here would claim every command row in the app.
 */
export const windowContextMenu: ContextMenuContributor = {
  id: "custom-layout",
  contribute(action: LauncherAction, ctx) {
    if (!action.id.startsWith(CUSTOM_LAYOUT_PREFIX)) return null;

    const id = action.id.slice(CUSTOM_LAYOUT_PREFIX.length);

    return {
      role: "primary" as const,
      actions: [
        {
          id: "apply",
          label: "Apply Layout",
          shortcut: "Enter",
          onSelect: () => ctx.runAction(action),
        },
        {
          id: "edit",
          section: "Manage Command",
          label: "Edit Command",
          onSelect: () =>
            ctx.push({ name: "custom-layout-edit", payload: { id } }),
        },
        {
          id: "duplicate",
          section: "Manage Command",
          label: "Duplicate Command",
          onSelect: () =>
            ctx.push({ name: "custom-layout-duplicate", payload: { id } }),
        },
        {
          id: "manage",
          section: "Manage Command",
          label: "Manage Commands",
          onSelect: () => ctx.push({ name: "custom-layout-list" }),
        },
        {
          id: "copy-name",
          section: "Copy",
          label: "Copy Name",
          shortcut: "CommandOrControl+C",
          onSelect: () => void navigator.clipboard.writeText(action.title),
        },
        {
          id: "delete",
          section: "Danger Zone",
          label: "Delete Command",
          confirmLabel: `Click again to delete "${action.title}"`,
          danger: true,
          onSelect: async () => {
            await window.api.window.customLayout.delete(id);
            ctx.reload();
          },
        },
      ],
    };
  },
};

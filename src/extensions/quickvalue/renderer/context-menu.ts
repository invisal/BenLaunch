import type { ContextMenuContributor } from "@renderer/screens/launcher/context-menu/types";

/**
 * The Ctrl+K menu for a QuickValue row. A QuickValue row is a *value*, not an
 * action — so the primary verb is "Copy Value" (like the calculator row), not
 * "Run". Everything here goes through the existing `window.api` surface; the
 * store and runner stay in the main process.
 */
export const quickValueContextMenu: ContextMenuContributor = {
  id: "quickvalue",
  contribute(action, ctx) {
    if (action.type !== "quickvalue") return null;

    const slug = action.id.slice("qv:".length);

    return {
      role: "primary",
      actions: [
        {
          id: "copy-value",
          label: "Copy Value",
          shortcut: "Enter",
          onSelect: () => {
            // The row's own SearchItem may have fetched a newer value than the
            // `subtitle` snapshot on `action` — ask for the current one.
            void window.api.requestSubtitle(action.id).then((value) => {
              if (value) void navigator.clipboard.writeText(value);
            });
            ctx.dismiss();
          },
        },
        {
          id: "refresh",
          label: "Refresh",
          onSelect: () => {
            // `execute` re-runs the snippet for real (and counts as a usage
            // pick); the force-refresh signal is what makes the row visibly
            // pick up the new value now instead of on the next query.
            void window.api.execute(action.id, ctx.query);
            ctx.forceRefresh(action.id);
          },
        },
        {
          id: "edit",
          label: "Edit QuickValue",
          onSelect: () => ctx.push({ name: "quickvalue-edit", id: slug }),
        },
        {
          id: "manage",
          label: "Manage QuickValues",
          onSelect: () => ctx.push({ name: "quickvalue-list" }),
        },
      ],
    };
  },
};

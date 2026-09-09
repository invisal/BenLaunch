import type { ContextMenuContributor } from "./types";

/**
 * Last in the chain: the generic block for any action nothing else claimed with
 * a `role: "primary"` contribution — installed apps and built-in commands.
 * Quicklinks and Widgets supply their own primary block, so this never runs
 * for them.
 */
export const defaultContextMenu: ContextMenuContributor = {
  id: "default",
  contribute(action, ctx) {
    return {
      role: "primary",
      actions: [
        {
          id: "run",
          label: action.type === "quicklink" ? "Open Quicklink" : "Run",
          shortcut: "Enter",
          onSelect: () => ctx.runAction(action),
        },
        {
          id: "copy-name",
          label: "Copy Name",
          shortcut: "CommandOrControl+C",
          onSelect: () => void navigator.clipboard.writeText(action.title),
        },
        {
          id: "pin",
          label: ctx.pinned ? "Unpin" : "Pin",
          shortcut: "CommandOrControl+P",
          onSelect: () => ctx.togglePin(),
        },
      ],
    };
  },
};

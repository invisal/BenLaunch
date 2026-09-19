import type {
  ContextMenuContributor,
  MenuActionItem,
} from "@renderer/screens/launcher/context-menu/types";
import HotkeyPanel from "./HotkeyPanel";

/**
 * Always augments — every action, of every type, can get a global hotkey
 * (see the main-process side in `../main/store.ts` and `main/index.ts`'s
 * `runBoundAction`), so this never claims the primary block.
 *
 * A `panel` row for setting/changing it, the same as the "Alias" row: the
 * combo is captured directly inside `HotkeyPanel`, not picked from a list,
 * so it doesn't fit an `items` submenu the way quicklinks' "Open With" does.
 * "Remove Hotkey" stays a plain guarded leaf alongside it.
 */
export const hotkeyContextMenu: ContextMenuContributor = {
  id: "hotkey",
  contribute(action, ctx) {
    const bound = ctx.actionHotkeys[action.id];

    const items: MenuActionItem[] = [
      {
        id: "hotkey",
        label: bound ? "Change Hotkey" : "Set Hotkey…",
        separator: true,
        shortcut: bound?.accelerator,
        panel: ({ onClose }) => (
          <HotkeyPanel
            actionId={action.id}
            actionType={action.type}
            title={action.title}
            icon={action.icon}
            current={bound?.accelerator}
            onClose={() => {
              onClose();
              ctx.refreshActionHotkeys();
            }}
          />
        ),
      },
      ...(bound
        ? [
            {
              id: "remove",
              label: "Remove Hotkey",
              confirmLabel: "Confirm removal",
              danger: true,
              keepOpen: true,
              onSelect: () => {
                void window.api.actionHotkeys
                  .remove(action.id)
                  .then(() => ctx.refreshActionHotkeys());
              },
            } satisfies MenuActionItem,
          ]
        : []),
    ];

    return items;
  },
};

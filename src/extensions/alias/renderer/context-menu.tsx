import type { ContextMenuContributor } from "@renderer/screens/launcher/context-menu/types";
import AliasPanel from "./AliasPanel";

/** The row's stable key — its `panel` trail segment, and how `Footer.Menu`
 *  restores the highlight to it once the panel closes. */
export const ALIAS_MENU_ITEM_ID = "alias";

/**
 * Adds a "Set/Change Alias" row to every action, including quicklinks — the
 * one place any action's alias is set (see `@extensions/alias/main/store`).
 *
 * A `panel` row, not an `items` submenu the way "Hotkey" is: an alias is
 * free text, not a combo or a choice from a list — see `AliasPanel`.
 */
export const aliasContextMenu: ContextMenuContributor = {
  id: "alias",
  contribute(action, ctx) {
    const current = ctx.actionAliases[action.id];

    return [
      {
        id: ALIAS_MENU_ITEM_ID,
        label: current ? "Change Alias" : "Set Alias…",
        separator: true,
        hint: current,
        panel: ({ onClose }: { onClose: () => void }) => (
          <AliasPanel
            actionId={action.id}
            title={action.title}
            icon={action.icon}
            current={current}
            onClose={() => {
              onClose();
              ctx.refreshActionAliases();
              ctx.reload();
            }}
          />
        ),
      },
    ];
  },
};

import type { ContextMenuContributor } from "@renderer/screens/launcher/context-menu/types";
import AliasPanel from "./AliasPanel";

/** The row's stable key — its `panel` trail segment, and how `Footer.Menu`
 *  restores the highlight to it once the panel closes. */
export const ALIAS_MENU_ITEM_ID = "alias";

/**
 * Augments every action EXCEPT quicklinks — they already have their own
 * dedicated "Alias" field on the Create/Edit form, backed by their own
 * stored `keyword`.
 *
 * A `panel` row, not an `items` submenu the way "Hotkey" is: an alias is
 * free text, not a combo or a choice from a list — see `AliasPanel`.
 */
export const aliasContextMenu: ContextMenuContributor = {
  id: "alias",
  contribute(action, ctx) {
    if (action.type === "quicklink") return null;

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

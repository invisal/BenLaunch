import type { ContextMenuContributor } from "@renderer/screens/launcher/context-menu/types";
import { questionAndAnswer } from "../shared/format";
import { HISTORY_ROUTE, PIN_ACTION_PREFIX } from "../shared/types";

/**
 * The Ctrl+K menu for a pinned calculation row in the launcher. Like a Widget
 * row it's a *value*, so the primary verb is "Copy Value" — asking main for
 * the live value rather than trusting the row's `subtitle` snapshot.
 */
export const calculatorHistoryContextMenu: ContextMenuContributor = {
  id: "calculator-history",
  contribute(action, ctx) {
    if (
      action.type !== "calculation" ||
      !action.id.startsWith(PIN_ACTION_PREFIX)
    ) {
      return null;
    }
    const entryId = action.id.slice(PIN_ACTION_PREFIX.length);

    return {
      role: "primary",
      actions: [
        {
          id: "copy-value",
          label: "Copy Value",
          shortcut: "Enter",
          onSelect: () => ctx.runAction(action),
        },
        {
          id: "copy-question-and-answer",
          label: "Copy Question & Answer",
          onSelect: () => {
            void window.api.requestSubtitle(action.id).then((value) => {
              if (!value) return;
              void navigator.clipboard.writeText(
                questionAndAnswer({ expression: action.title, value }),
              );
            });
            ctx.dismiss();
          },
        },
        {
          id: "refresh",
          label: "Refresh",
          onSelect: () => ctx.forceRefresh(action.id),
        },
        {
          id: "unpin",
          label: "Unpin Calculation",
          onSelect: () => {
            void window.api.calculatorHistory
              .setPinned(entryId, false)
              .then(() => ctx.reload());
          },
        },
        {
          id: "open-history",
          label: "Open Calculator History",
          onSelect: () => ctx.push({ name: HISTORY_ROUTE }),
        },
      ],
    };
  },
};

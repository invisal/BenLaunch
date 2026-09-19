import type { LauncherAction } from "@shared/types";
import { calculatorHistoryContextMenu } from "@extensions/calculator-history/renderer/context-menu";
import { aliasContextMenu } from "@extensions/alias/renderer/context-menu";
import { hotkeyContextMenu } from "@extensions/hotkey/renderer/context-menu";
import { quicklinkContextMenu } from "@extensions/quicklink/renderer/context-menu";
import { widgetContextMenu } from "@extensions/widget/renderer/context-menu";
import { windowContextMenu } from "@extensions/window/renderer/context-menu";
import type {
  ContextMenuContext,
  ContextMenuContributor,
  MenuActionItem,
} from "./types";
import { defaultContextMenu } from "./default";

/**
 * The Ctrl+K menu is built by an ordered chain of contributors. Each is a plain
 * renderer module — no constructor, no main-process imports; whatever it needs
 * beyond the `LauncherAction` comes from `window.api` or the `ContextMenuContext`
 * that `App` passes in.
 *
 * A contributor returns `null` (abstain), a `MenuActionItem[]` (append and keep
 * going), or `{ role: "primary", actions }` (the main block — first one wins).
 * `defaultContextMenu` is last, so it only fills the primary block when nothing
 * more specific claimed the action.
 *
 * To give a new extension its own item, add its module here — nothing else in
 * the launcher needs to change.
 */
const contributors: ContextMenuContributor[] = [
  widgetContextMenu,
  calculatorHistoryContextMenu,
  // Before `quicklinkContextMenu` so it claims the primary block for
  // `win:custom:*` rows; the quicklink contributor still appends its "Create
  // Quicklink" item to them, same as any other command row.
  windowContextMenu,
  quicklinkContextMenu,
  defaultContextMenu,
  // Last: appends "Set Hotkey…" / "Remove Hotkey" to whatever primary block
  // and augments above already assembled, for every action type.
  hotkeyContextMenu,
  // Same treatment for "Alias" — every action type, quicklinks included.
  aliasContextMenu,
];

/** Assemble the Ctrl+K menu for the highlighted action: `[...firstPrimary, ...allAugments]`. */
export function buildContextMenu(
  action: LauncherAction,
  ctx: ContextMenuContext,
): MenuActionItem[] {
  let primary: MenuActionItem[] | null = null;
  const augments: MenuActionItem[] = [];

  for (const contributor of contributors) {
    const result = contributor.contribute(action, ctx);
    if (!result) continue;
    if (Array.isArray(result)) augments.push(...result);
    else if (result.role === "primary" && !primary) primary = result.actions;
  }

  return [...(primary ?? []), ...augments];
}

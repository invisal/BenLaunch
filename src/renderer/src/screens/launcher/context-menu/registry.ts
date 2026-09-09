import type { LauncherAction } from "@shared/types";
import { widgetContextMenu } from "@extensions/widget/renderer/context-menu";
import type { ContextMenuContext, ContextMenuContributor, MenuActionItem } from "./types";
import { customLayoutContextMenu } from "./custom-layout";
import { defaultContextMenu } from "./default";
import { quicklinkContextMenu } from "./quicklink";

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
  // Before `quicklinkContextMenu` so it claims the primary block for
  // `win:custom:*` rows; the quicklink contributor still appends its "Create
  // Quicklink" item to them, same as any other command row.
  customLayoutContextMenu,
  quicklinkContextMenu,
  defaultContextMenu,
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

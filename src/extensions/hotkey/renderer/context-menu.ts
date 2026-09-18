import type {
  ContextMenuContributor,
  MenuActionItem,
} from "@renderer/screens/launcher/context-menu/types";

/**
 * Always augments — every action, of every type, can get a global hotkey
 * (see the main-process side in `../main/store.ts` and `main/index.ts`'s
 * `runBoundAction`), so this never claims the primary block.
 *
 * "Hotkey" is a submenu (`items`), not a leaf: the same `Footer.Menu` popup
 * opens it in place of the current list (arrow keys/Enter/Escape all keep
 * working exactly as they do everywhere else in the menu — Escape in
 * particular steps back to the action list, rather than closing the whole
 * menu, since Base UI's popup already treats that as "leave the submenu").
 * Binding/removal happen right here via `window.api.actionHotkeys`; the
 * actual keypress capture lives in `LauncherScreen` (`ctx.startRecordingHotkey`),
 * since it has to run for as long as the row stays selected, independent of
 * this (pure, called-fresh-every-render) `contribute()`.
 */
export const hotkeyContextMenu: ContextMenuContributor = {
  id: "hotkey",
  contribute(action, ctx) {
    const bound = ctx.actionHotkeys[action.id];
    const recording = ctx.recordingHotkeyFor === action.id;
    const pending = recording ? ctx.pendingHotkeyAccelerator : null;
    const error =
      ctx.hotkeyBindError?.actionId === action.id
        ? ctx.hotkeyBindError.message
        : null;

    const items: MenuActionItem[] = [
      {
        id: "bind",
        label: pending
          ? "Press Enter to confirm, Esc to cancel"
          : recording
            ? "Press keys… (Esc to cancel)"
            : bound
              ? "Change Hotkey"
              : "Click to Bind",
        // The captured-but-unconfirmed combo shows as the row's own shortcut
        // badge — the same spot the already-bound accelerator sits in.
        shortcut: pending ?? undefined,
        disabled: recording,
        keepOpen: true,
        onSelect: () => ctx.startRecordingHotkey(action.id, action.type),
      },
      ...(bound && !recording
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
      ...(error
        ? [
            {
              id: "error",
              label: error,
              disabled: true,
              onSelect: () => {},
            } satisfies MenuActionItem,
          ]
        : []),
    ];

    return [
      {
        id: "hotkey",
        label: "Hotkey",
        separator: true,
        shortcut: bound?.accelerator,
        items,
      },
    ];
  },
};

import type { LauncherActionType } from "../../../shared/types";

/**
 * A global (OS-level) hotkey bound directly to one action, so pressing it
 * runs that action without opening the launcher first. `type` is captured
 * from the `LauncherAction` at bind time — the main process needs it to
 * decide how to run the action later (see `main/register.ts`) without
 * re-querying every source for one id on every keypress.
 */
export interface ActionHotkeyBinding {
  accelerator: string;
  type: LauncherActionType;
}

/** Result of a `set` call — mirrors the shape of the core toggle hotkey's `HotkeySetResult`. */
export interface ActionHotkeySetResult {
  success: boolean;
  /** The binding actually in effect for this action after the call, or `null` if none. */
  binding: ActionHotkeyBinding | null;
}

export const HOTKEY_CHANNELS = {
  /** actionId -> binding, for every action with a hotkey right now. */
  list: "hotkey:list",
  set: "hotkey:set",
  remove: "hotkey:remove",
  /**
   * Main -> launcher window push: a bound hotkey fired and its action wants
   * to navigate (e.g. it opened an editor screen) rather than just running
   * silently. Carries a `NavigateRequest`-shaped `{ name, payload }`.
   */
  triggerNavigate: "hotkey:trigger-navigate",
} as const;

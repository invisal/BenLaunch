import { ipcRenderer } from "electron";
import type { NavigateRequest } from "../../../shared/types";
import { HOTKEY_CHANNELS } from "../shared/types";
import type {
  ActionHotkeyBinding,
  ActionHotkeySetResult,
} from "../shared/types";

/** `window.api.actionHotkeys` — the Ctrl+K menu's and Bind Hotkey screen's bridge to main. */
export const actionHotkeysApi = {
  list: (): Promise<Record<string, ActionHotkeyBinding>> =>
    ipcRenderer.invoke(HOTKEY_CHANNELS.list),
  set: (
    actionId: string,
    accelerator: string,
    type: ActionHotkeyBinding["type"],
  ): Promise<ActionHotkeySetResult> =>
    ipcRenderer.invoke(HOTKEY_CHANNELS.set, actionId, accelerator, type),
  remove: (actionId: string): Promise<void> =>
    ipcRenderer.invoke(HOTKEY_CHANNELS.remove, actionId),
  /**
   * A bound hotkey fired while the launcher was hidden and its action wants
   * to navigate (rather than just running silently) — main reveals the
   * window and pushes the route here instead of the usual `execute()`
   * return value, since there was no renderer-initiated call to return it to.
   */
  onTriggerNavigate: (
    callback: (route: NavigateRequest) => void,
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      route: NavigateRequest,
    ): void => callback(route);
    ipcRenderer.on(HOTKEY_CHANNELS.triggerNavigate, listener);
    return () =>
      ipcRenderer.removeListener(HOTKEY_CHANNELS.triggerNavigate, listener);
  },
};

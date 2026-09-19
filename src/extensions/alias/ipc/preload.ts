import { ipcRenderer } from "electron";
import { ALIAS_CHANNELS } from "../shared/types";

/** `window.api.actionAliases` — the Ctrl+K menu's bridge to main. */
export const actionAliasesApi = {
  list: (): Promise<Record<string, string>> =>
    ipcRenderer.invoke(ALIAS_CHANNELS.list),
  set: (actionId: string, alias: string): Promise<void> =>
    ipcRenderer.invoke(ALIAS_CHANNELS.set, actionId, alias),
  remove: (actionId: string): Promise<void> =>
    ipcRenderer.invoke(ALIAS_CHANNELS.remove, actionId),
};

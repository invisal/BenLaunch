import { contextBridge, ipcRenderer } from "electron";
import {
  IPC_CHANNELS,
  type CalculatorSettings,
  type ExecuteResult,
  type HotkeySetResult,
  type QueryResult,
  type RequestSubtitleOptions,
} from "../shared/types";
import { calculatorHistoryApi } from "@extensions/calculator-history/ipc/preload";
import { clipboardHistoryApi } from "@extensions/clipboard-history/ipc/preload";
import { groupApi } from "@extensions/group/ipc/preload";
import { quicklinkApi } from "@extensions/quicklink/ipc/preload";
import { widgetApi } from "@extensions/widget/ipc/preload";
import { windowApi } from "@extensions/window/ipc/preload";

const api = {
  platform: process.platform,
  query: (text: string): Promise<QueryResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.query, text),
  /** `argument` is the text typed into the launcher's argument chip, if any. */
  execute: (
    id: string,
    text: string,
    argument?: string,
  ): Promise<ExecuteResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.execute, id, text, argument),
  hide: (): void => ipcRenderer.send(IPC_CHANNELS.hide),
  togglePin: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.togglePin),

  /** Settings → Calculator: crypto prices on/off, number format. */
  calculatorSettings: {
    get: (): Promise<CalculatorSettings> =>
      ipcRenderer.invoke(IPC_CHANNELS.calculatorSettingsGet),
    set: (patch: Partial<CalculatorSettings>): Promise<CalculatorSettings> =>
      ipcRenderer.invoke(IPC_CHANNELS.calculatorSettingsSet, patch),
  },

  /** Settings → General: read / rebind the global toggle shortcut. */
  hotkey: {
    get: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.hotkeyGet),
    set: (accelerator: string): Promise<HotkeySetResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.hotkeySet, accelerator),
  },

  /** Launcher: a deferred-subtitle row rendered (or force-refreshed) — resolves with the fresh subtitle. */
  requestSubtitle: (
    actionId: string,
    opts?: RequestSubtitleOptions,
  ): Promise<string | undefined> =>
    ipcRenderer.invoke(IPC_CHANNELS.requestSubtitle, actionId, opts),

  /** Window-chrome controls for the framed windows (Settings, Widget), which
   *  render their own title bar. Each acts on the calling window. */
  windowControls: {
    minimize: (): void => ipcRenderer.send(IPC_CHANNELS.windowMinimize),
    toggleMaximize: (): void =>
      ipcRenderer.send(IPC_CHANNELS.windowToggleMaximize),
    close: (): void => ipcRenderer.send(IPC_CHANNELS.windowClose),
  },

  /** Widget manager window ↔ main. */
  widget: widgetApi,

  /** Window management (OS-level control + the custom-layout manager) ↔ main. */
  window: windowApi,

  /** Calculator History (record, list, pin) ↔ main. */
  calculatorHistory: calculatorHistoryApi,

  /** Clipboard History (list, pin, delete, copy-again) ↔ main. */
  clipboardHistory: clipboardHistoryApi,

  /** Quicklinks: the Create/Edit/Duplicate form and the Ctrl+K menu ↔ main. */
  quicklink: quicklinkApi,

  /** Group manager screen ↔ main. */
  group: groupApi,
};

contextBridge.exposeInMainWorld("api", api);

export type LauncherApi = typeof api;

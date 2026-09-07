import { ipcRenderer } from "electron";
import { QUICKVALUE_CHANNELS } from "../shared/types";
import type {
  QuickValueDef,
  QuickValueDraft,
  QuickValueTestResult,
} from "../shared/types";

/** `window.api.quickValue` — the QuickValue manager window's bridge to main. */
export const quickValueApi = {
  list: (): Promise<QuickValueDef[]> =>
    ipcRenderer.invoke(QUICKVALUE_CHANNELS.list),
  get: (id: string): Promise<QuickValueDef | null> =>
    ipcRenderer.invoke(QUICKVALUE_CHANNELS.get, id),
  save: (draft: QuickValueDraft): Promise<QuickValueDef> =>
    ipcRenderer.invoke(QUICKVALUE_CHANNELS.save, draft),
  delete: (id: string): Promise<void> =>
    ipcRenderer.invoke(QUICKVALUE_CHANNELS.delete, id),
  setExposed: (id: string, exposed: boolean): Promise<void> =>
    ipcRenderer.invoke(QUICKVALUE_CHANNELS.setExposed, id, exposed),
  test: (code: string): Promise<QuickValueTestResult> =>
    ipcRenderer.invoke(QUICKVALUE_CHANNELS.test, code),
};

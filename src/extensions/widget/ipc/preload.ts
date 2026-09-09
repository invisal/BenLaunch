import { ipcRenderer } from "electron";
import { WIDGET_CHANNELS } from "../shared/types";
import type {
  WidgetDef,
  WidgetDraft,
  WidgetTestResult,
} from "../shared/types";

/** `window.api.widget` — the Widget manager window's bridge to main. */
export const widgetApi = {
  list: (): Promise<WidgetDef[]> =>
    ipcRenderer.invoke(WIDGET_CHANNELS.list),
  get: (id: string): Promise<WidgetDef | null> =>
    ipcRenderer.invoke(WIDGET_CHANNELS.get, id),
  save: (draft: WidgetDraft): Promise<WidgetDef> =>
    ipcRenderer.invoke(WIDGET_CHANNELS.save, draft),
  delete: (id: string): Promise<void> =>
    ipcRenderer.invoke(WIDGET_CHANNELS.delete, id),
  setExposed: (id: string, exposed: boolean): Promise<void> =>
    ipcRenderer.invoke(WIDGET_CHANNELS.setExposed, id, exposed),
  test: (code: string): Promise<WidgetTestResult> =>
    ipcRenderer.invoke(WIDGET_CHANNELS.test, code),
};

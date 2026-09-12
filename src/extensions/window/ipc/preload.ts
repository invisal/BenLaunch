import { ipcRenderer } from "electron";
import { WINDOW_CHANNELS } from "../shared/types";
import type {
  CustomLayoutDef,
  CustomLayoutDraft,
  DisplayPreviewInfo,
} from "../shared/types";

/** `window.api.window` — the custom-layout manager screens' and Settings' bridge to main. */
export const windowApi = {
  customLayout: {
    list: (): Promise<CustomLayoutDef[]> =>
      ipcRenderer.invoke(WINDOW_CHANNELS.customLayoutList),
    get: (id: string): Promise<CustomLayoutDef | null> =>
      ipcRenderer.invoke(WINDOW_CHANNELS.customLayoutGet, id),
    save: (draft: CustomLayoutDraft): Promise<CustomLayoutDef> =>
      ipcRenderer.invoke(WINDOW_CHANNELS.customLayoutSave, draft),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(WINDOW_CHANNELS.customLayoutDelete, id),
  },
  getGapSize: (): Promise<number> =>
    ipcRenderer.invoke(WINDOW_CHANNELS.gapSize),
  setGapSize: (px: number): Promise<void> =>
    ipcRenderer.invoke(WINDOW_CHANNELS.setGapSize, px),
  getDisplayInfo: (): Promise<DisplayPreviewInfo> =>
    ipcRenderer.invoke(WINDOW_CHANNELS.displayInfo),
  getAccessibilityStatus: (): Promise<boolean> =>
    ipcRenderer.invoke(WINDOW_CHANNELS.accessibilityStatus),
  requestAccessibility: (): Promise<boolean> =>
    ipcRenderer.invoke(WINDOW_CHANNELS.requestAccessibility),
};

import { ipcRenderer } from "electron";
import { GROUP_CHANNELS } from "../shared/types";
import type { GroupDef, GroupDraft } from "../shared/types";

/** `window.api.group` — the Group manager screen's bridge to main. */
export const groupApi = {
  list: (): Promise<GroupDef[]> => ipcRenderer.invoke(GROUP_CHANNELS.list),
  get: (id: string): Promise<GroupDef | null> =>
    ipcRenderer.invoke(GROUP_CHANNELS.get, id),
  save: (draft: GroupDraft): Promise<GroupDef> =>
    ipcRenderer.invoke(GROUP_CHANNELS.save, draft),
  delete: (id: string): Promise<void> =>
    ipcRenderer.invoke(GROUP_CHANNELS.delete, id),
};

import { dialog, ipcMain, type BrowserWindow } from "electron";
import { listOpenWithApps } from "@main/sources/apps/open-with";
import { QUICKLINK_CHANNELS, type QuicklinkDraft } from "../shared/types";
import type { QuicklinkSource } from "../index";

/**
 * The bits of the launcher window's own state that `quicklinkOpenWith` and
 * `quicklinkPickPath` need — owned by `main/index.ts` (the launcher's
 * `pinned` flag, its blur-to-hide suppression, and the window handle itself),
 * passed in rather than duplicated here.
 */
export interface QuicklinkIpcHost {
  getLauncherWindow: () => BrowserWindow | null;
  setSuppressAutoHide: (value: boolean) => void;
  /** Hide the launcher after a link opens, unless it's pinned open. */
  hideAfterOpen: () => void;
}

/** Wires the Create/Edit form's and the Ctrl+K menu's quicklink calls to the source. */
export function registerQuicklinkIpc(
  source: QuicklinkSource,
  openWith: (id: string, text: string, appPath: string) => Promise<void>,
  host: QuicklinkIpcHost,
): void {
  ipcMain.handle(QUICKLINK_CHANNELS.create, (_event, draft: QuicklinkDraft) =>
    source.create(draft),
  );
  ipcMain.handle(
    QUICKLINK_CHANNELS.update,
    (_event, id: string, draft: QuicklinkDraft) => source.update(id, draft),
  );
  ipcMain.handle(
    QUICKLINK_CHANNELS.get,
    (_event, id: string) => source.get(id) ?? null,
  );
  ipcMain.handle(QUICKLINK_CHANNELS.delete, (_event, id: string) => {
    source.remove(id);
  });
  ipcMain.handle(
    QUICKLINK_CHANNELS.setPinned,
    (_event, id: string, pinned: boolean) => {
      source.setPinned(id, pinned);
    },
  );
  ipcMain.handle(
    QUICKLINK_CHANNELS.setHidden,
    (_event, id: string, hidden: boolean) => {
      source.setHidden(id, hidden);
    },
  );

  ipcMain.handle(
    QUICKLINK_CHANNELS.openWith,
    (_event, id: string, text: string, appPath: string) => {
      // Mirror the main execute handler: hide first so the launcher vanishes at once.
      host.hideAfterOpen();
      return openWith(id, text, appPath);
    },
  );

  ipcMain.handle(
    QUICKLINK_CHANNELS.pickPath,
    async (_event, type: "file" | "directory"): Promise<string | null> => {
      const options = {
        properties: [
          type === "directory" ? "openDirectory" : "openFile",
        ] as Array<"openDirectory" | "openFile">,
      };
      const launcherWindow = host.getLauncherWindow();
      host.setSuppressAutoHide(true);
      try {
        const result = launcherWindow
          ? await dialog.showOpenDialog(launcherWindow, options)
          : await dialog.showOpenDialog(options);
        return result.canceled ? null : (result.filePaths[0] ?? null);
      } finally {
        host.setSuppressAutoHide(false);
        // The dialog took focus; hand it back so the form stays interactive and
        // a later real focus loss hides the launcher as usual.
        launcherWindow?.focus();
      }
    },
  );

  ipcMain.handle(QUICKLINK_CHANNELS.openWithApps, () => listOpenWithApps());
}

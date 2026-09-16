import { dialog, ipcMain, type BrowserWindow } from "electron";
import { listOpenWithApps } from "@main/sources/apps/open-with";
import {
  QUICKLINK_CHANNELS,
  type QuicklinkDraft,
  type QuicklinkEntry,
} from "../shared/types";
import { resolveIcon } from "../main/icon";
import type { QuicklinkDialogHost, QuicklinkSource } from "../index";

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
  /**
   * How often / how recently the action `ql:<id>` has been run, from the
   * launcher's usage store (owned by `actions.ts`, not by this extension) —
   * the manager screen's "Opened" row.
   */
  usageOf: (
    actionId: string,
  ) => { count: number; lastUsedAt: number } | undefined;
}

/**
 * Run a modal file dialog the way the launcher needs it: parented to the
 * launcher window, with blur-to-hide suppressed for the duration and focus
 * handed back afterwards — otherwise the launcher vanishes behind the sheet and
 * the form it was showing is gone when the dialog closes.
 *
 * The one place that protocol lives; `pickPath` below and Import/Export in
 * `index.ts` all go through it.
 */
export async function withLauncherDialog<T>(
  host: QuicklinkDialogHost | null,
  run: (parent: BrowserWindow | null) => Promise<T>,
): Promise<T> {
  const parent = host?.getLauncherWindow() ?? null;
  host?.setSuppressAutoHide(true);
  try {
    return await run(parent);
  } finally {
    host?.setSuppressAutoHide(false);
    parent?.focus();
  }
}

/** Wires the Create/Edit form's and the Ctrl+K menu's quicklink calls to the source. */
export function registerQuicklinkIpc(
  source: QuicklinkSource,
  openWith: (id: string, text: string, appPath: string) => Promise<void>,
  host: QuicklinkIpcHost,
): void {
  // Import/Export run from launcher rows (in main), not over IPC, but they open
  // a file dialog and so need the same window state `pickPath` below does.
  source.useDialogs(host);

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
  ipcMain.handle(QUICKLINK_CHANNELS.list, (): QuicklinkEntry[] =>
    source.list().map((link) => {
      const used = host.usageOf(`ql:${link.id}`);
      return {
        ...link,
        opens: used?.count ?? 0,
        ...(used ? { lastOpenedAt: used.lastUsedAt } : {}),
      };
    }),
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
    (_event, type: "file" | "directory"): Promise<string | null> =>
      withLauncherDialog(host, async (parent) => {
        const options = {
          properties: [
            type === "directory" ? "openDirectory" : "openFile",
          ] as Array<"openDirectory" | "openFile">,
        };
        const result = parent
          ? await dialog.showOpenDialog(parent, options)
          : await dialog.showOpenDialog(options);
        return result.canceled ? null : (result.filePaths[0] ?? null);
      }),
  );

  ipcMain.handle(QUICKLINK_CHANNELS.openWithApps, () => listOpenWithApps());

  ipcMain.handle(
    QUICKLINK_CHANNELS.icon,
    (_event, link: string): Promise<string | null> => resolveIcon(link),
  );

  ipcMain.handle(
    QUICKLINK_CHANNELS.preview,
    (_event, actionId: string, argument: string): string | null =>
      source.preview(actionId, argument),
  );
}

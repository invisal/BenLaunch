import { ipcRenderer } from "electron";
import { QUIT_PROCESS_CHANNELS } from "../shared/types";
import type { ProcessRow } from "../shared/types";

/** `window.api.quitProcess` — the process list screen's bridge to main. */
export const quitProcessApi = {
  /** One-shot fetch, independent of whether the background poller is running. */
  list: (): Promise<ProcessRow[]> =>
    ipcRenderer.invoke(QUIT_PROCESS_CHANNELS.list),
  /** Starts the background poller — call on screen mount. */
  start: (): Promise<void> => ipcRenderer.invoke(QUIT_PROCESS_CHANNELS.start),
  /** Stops the background poller — call on screen unmount, so BenLaunch never
   *  keeps re-listing every running process while the window is hidden. */
  stop: (): Promise<void> => ipcRenderer.invoke(QUIT_PROCESS_CHANNELS.stop),
  /** Fires whenever the poller refreshes, carrying the fresh snapshot
   *  directly. Returns an unsubscribe function. */
  onUpdated: (callback: (rows: ProcessRow[]) => void): (() => void) => {
    const listener = (_event: unknown, rows: ProcessRow[]) => callback(rows);
    ipcRenderer.on(QUIT_PROCESS_CHANNELS.updated, listener);
    return () =>
      ipcRenderer.removeListener(QUIT_PROCESS_CHANNELS.updated, listener);
  },
  /** `force: false` sends SIGTERM ("Kill"), `true` sends SIGKILL ("Force
   *  Kill"); several pids for "Kill All". Resolves `false` if any is still
   *  alive and couldn't be signalled (permission denied). */
  kill: (pids: number[], force: boolean): Promise<boolean> =>
    ipcRenderer.invoke(QUIT_PROCESS_CHANNELS.kill, pids, force),
  /** Kill `pids`, wait for them to exit, relaunch what `mainPid` came from. */
  restart: (
    mainPid: number,
    pids: number[],
    force: boolean,
  ): Promise<boolean> =>
    ipcRenderer.invoke(QUIT_PROCESS_CHANNELS.restart, mainPid, pids, force),
};

import type { IpcMain } from "electron";
import type { QuitProcessPoller } from "../main/poller";
import { killProcesses, listProcesses } from "../main/process-source";
import { restartProcesses } from "../main/restart";
import { QUIT_PROCESS_CHANNELS } from "../shared/types";

/** Wires the process list screen's list/start/stop/kill/restart calls to the poller
 *  and the native process source. */
export function registerQuitProcessIpc(
  ipc: IpcMain,
  poller: QuitProcessPoller,
): void {
  ipc.handle(QUIT_PROCESS_CHANNELS.list, () => listProcesses());
  ipc.handle(QUIT_PROCESS_CHANNELS.start, () => {
    poller.start();
  });
  ipc.handle(QUIT_PROCESS_CHANNELS.stop, () => {
    poller.stop();
  });
  ipc.handle(
    QUIT_PROCESS_CHANNELS.kill,
    (_event, pids: number[], force: boolean) =>
      killProcesses(pids, force).length === 0,
  );
  ipc.handle(
    QUIT_PROCESS_CHANNELS.restart,
    (_event, mainPid: number, pids: number[], force: boolean) =>
      restartProcesses(mainPid, pids, force),
  );
}

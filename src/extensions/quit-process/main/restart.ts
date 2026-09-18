import { spawn } from "node:child_process";
import { shell } from "electron";
import { isAlive, killProcesses, listProcesses } from "./process-source";

const EXIT_TIMEOUT_MS = 5000;
const EXIT_POLL_MS = 100;

async function waitForExit(pids: number[]): Promise<boolean> {
  const deadline = Date.now() + EXIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!pids.some(isAlive)) return true;
    await new Promise((resolve) => setTimeout(resolve, EXIT_POLL_MS));
  }
  return false;
}

/**
 * Kills `pids`, waits for them to exit, then relaunches what `mainPid` was
 * started from — its app bundle on macOS, its executable elsewhere. The
 * launch target is read from the live process table here rather than taken
 * from the renderer, so the renderer can't make this open an arbitrary path.
 * A graceful "Kill" that the app ignores times out and resolves `false`
 * without relaunching (which would just start a second copy).
 */
export async function restartProcesses(
  mainPid: number,
  pids: number[],
  force: boolean,
): Promise<boolean> {
  const main = listProcesses().find((row) => row.pid === mainPid);
  const target = main?.appPath ?? main?.path;
  if (!target) return false;

  if (killProcesses(pids, force).length > 0) return false;
  if (!(await waitForExit(pids))) return false;

  if (process.platform === "darwin" && main?.appPath) {
    return (await shell.openPath(target)) === "";
  }
  spawn(target, [], { detached: true, stdio: "ignore" }).unref();
  return true;
}

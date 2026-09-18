import * as linux from "./process-source-linux";
import * as mac from "./process-source-mac";
import * as win from "./process-source-win";
import { outermostAppBundle } from "./app-bundle";
import { cachedProcessIcon } from "./icon";
import type { ProcessRow } from "../shared/types";

/** What each platform module reports, before icon resolution — `path` is
 *  the raw executable path the rest of `ProcessRow`'s path-derived fields
 *  (`icon`, `appPath`) are filled in from. */
export interface RawProcessRow {
  pid: number;
  name: string;
  cpuPercent: number;
  memoryBytes: number;
  path?: string;
}

/**
 * Platform dispatcher for process enumeration/termination — mirrors
 * `window/main/control/control.ts`. Callers (`poller.ts`, `ipc/handlers.ts`)
 * go through this module only, so neither needs a `process.platform` branch
 * of its own.
 */
function impl(): typeof win | typeof mac | typeof linux | null {
  if (process.platform === "win32") return win;
  if (process.platform === "darwin") return mac;
  if (process.platform === "linux") return linux;
  return null;
}

/** See `ProcessRow.appPath`. */
function appPathOf(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (process.platform !== "darwin") return path;
  return outermostAppBundle(path) ?? undefined;
}

/** A snapshot of every running process's pid, name, CPU%, memory and (where
 *  already resolved — see `cachedProcessIcon`) icon. Empty on an
 *  unsupported platform or if the native addon failed to load. Synchronous:
 *  never blocks on an icon lookup, so a poll tick's cost stays independent
 *  of how many distinct apps are running. */
export function listProcesses(): ProcessRow[] {
  const implementation = impl();
  const rows = implementation?.listProcesses() ?? [];
  const portsByPid = new Map<number, number[]>();
  for (const { pid, port } of implementation?.listPorts() ?? []) {
    const ports = portsByPid.get(pid);
    if (!ports) portsByPid.set(pid, [port]);
    else if (!ports.includes(port)) ports.push(port);
  }
  return rows.map((row) => ({
    ...row,
    icon: cachedProcessIcon(row.path) ?? undefined,
    appPath: appPathOf(row.path),
    ports: portsByPid.get(row.pid)?.sort((a, b) => a - b),
  }));
}

/** `force: false` sends SIGTERM ("Kill"), `true` sends SIGKILL ("Force
 *  Kill") — both are `TerminateProcess` on Windows. `false` on a missing
 *  pid, denied permission, or an unsupported platform. */
export function killProcess(pid: number, force: boolean): boolean {
  return impl()?.killProcess(pid, force) ?? false;
}

/** Whether `pid` is still running — signal 0 only probes. EPERM means it
 *  exists but isn't ours to signal. */
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Kills every pid in `pids` and returns the ones still alive that couldn't
 *  be signalled. `killProcess` alone can't tell "already gone" (a helper
 *  that exited with its parent) from "permission denied", so a failure is
 *  re-checked with `isAlive`. */
export function killProcesses(pids: number[], force: boolean): number[] {
  return pids.filter((pid) => !killProcess(pid, force) && isAlive(pid));
}

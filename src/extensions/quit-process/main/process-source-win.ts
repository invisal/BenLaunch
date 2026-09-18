import { createRequire } from "node:module";
import type { RawProcessRow } from "./process-source";

/** Same guarded-lazy-load pattern as `process-source-mac.ts`. */
type NativeWin = typeof import("@magibar/win");
const nodeRequire = createRequire(import.meta.url);
let native: NativeWin | null | undefined;

function loadNative(): NativeWin | null {
  if (native !== undefined) return native;
  if (process.platform !== "win32") return (native = null);
  try {
    native = nodeRequire("@magibar/win") as NativeWin;
  } catch (error) {
    console.error("[quit-process/win] Failed to load @magibar/win:", error);
    native = null;
  }
  return native;
}

/** A snapshot of every running process's pid, name, CPU%, memory and
 *  executable path (see `RawProcessRow`). */
export function listProcesses(): RawProcessRow[] {
  const win = loadNative();
  if (!win) return [];
  return win.listProcesses().map((p) => ({
    pid: p.pid,
    name: p.name,
    cpuPercent: p.cpuUsage,
    memoryBytes: p.memoryBytes,
    path: p.path,
  }));
}

/** `force` has no effect on Windows — both "Quit" and "Force Quit" call
 *  `TerminateProcess`, since there's no real SIGTERM equivalent there. Kept
 *  for a call shape identical to mac/linux. `false` when the pid no longer
 *  exists or access is denied. */
export function killProcess(pid: number, force: boolean): boolean {
  return loadNative()?.killProcess(pid, force) ?? false;
}

/** Every listening TCP port with its owning pid. */
export function listPorts(): { pid: number; port: number }[] {
  return loadNative()?.listListeningPorts() ?? [];
}

import { createRequire } from "node:module";
import type { RawProcessRow } from "./process-source";

/** Same guarded-lazy-load pattern as `process-source-mac.ts`. */
type NativeLinux = typeof import("@magibar/linux");
const nodeRequire = createRequire(import.meta.url);
let native: NativeLinux | null | undefined;

function loadNative(): NativeLinux | null {
  if (native !== undefined) return native;
  if (process.platform !== "linux") return (native = null);
  try {
    native = nodeRequire("@magibar/linux") as NativeLinux;
  } catch (error) {
    console.error("[quit-process/linux] Failed to load @magibar/linux:", error);
    native = null;
  }
  return native;
}

/** A snapshot of every running process's pid, name, CPU%, memory and
 *  executable path (see `RawProcessRow`). */
export function listProcesses(): RawProcessRow[] {
  const linux = loadNative();
  if (!linux) return [];
  return linux.listProcesses().map((p) => ({
    pid: p.pid,
    name: p.name,
    cpuPercent: p.cpuUsage,
    memoryBytes: p.memoryBytes,
    path: p.path,
  }));
}

/** `force: false` sends SIGTERM, `true` sends SIGKILL. `false` when the pid
 *  no longer exists or the OS denies permission. */
export function killProcess(pid: number, force: boolean): boolean {
  return loadNative()?.killProcess(pid, force) ?? false;
}

/** Every listening TCP port with its owning pid. */
export function listPorts(): { pid: number; port: number }[] {
  return loadNative()?.listListeningPorts() ?? [];
}

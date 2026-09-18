/**
 * Activity Monitor's wire contract — the DTOs and IPC channel names shared by
 * the extension's main handlers (`../ipc/handlers.ts`), its preload fragment
 * (`../ipc/preload.ts`) and its renderer screen (`../renderer/`).
 */

/** One running process, as reported by the native `listProcesses()` call. */
export interface ProcessRow {
  pid: number;
  name: string;
  /** Percentage of a single CPU core (0–100 per core, so a busy multi-core
   *  process can exceed 100) — matches Activity Monitor's own convention. */
  cpuPercent: number;
  memoryBytes: number;
  /** The app's icon (or the OS's generic executable icon), as a `data:` URI
   *  resolved by `main/icon.ts`. Absent while still resolving, or when none
   *  could be found — the row falls back to a generic icon either way. */
  icon?: string;
  /** Full path to the executable, when readable. */
  path?: string;
  /** What this process belongs to and can be relaunched from: on macOS the
   *  outermost `.app` bundle (so a browser's helper processes share their
   *  app's), elsewhere the executable path. Absent for a bare macOS
   *  executable or an unreadable one. */
  appPath?: string;
  /** TCP ports this process is listening on, ascending. Absent if none. */
  ports?: number[];
}

/** Route name of the process list screen (`../screen.tsx`). */
export const QUIT_PROCESS_ROUTE = "quit-process";

export const QUIT_PROCESS_CHANNELS = {
  list: "quit-process:list",
  /** Start/stop the background poller — only runs while the screen is open. */
  start: "quit-process:start",
  stop: "quit-process:stop",
  /** `force: false` sends SIGTERM ("Kill"), `true` sends SIGKILL ("Force
   *  Kill") — both are `TerminateProcess` on Windows, which has no SIGTERM
   *  equivalent. Takes several pids for "Kill All". Resolves `false` if any
   *  of them is still alive and couldn't be signalled (permission denied). */
  kill: "quit-process:kill",
  /** Kill `pids`, wait for them to exit, then relaunch what `mainPid` was
   *  started from. Resolves `false` if it couldn't. */
  restart: "quit-process:restart",
  /** Main → renderer push: the poller refreshed its snapshot. Carries the
   *  fresh `ProcessRow[]` directly, rather than a bare signal to re-fetch —
   *  the poller already has the data in hand from its own tick. */
  updated: "quit-process:updated",
} as const;

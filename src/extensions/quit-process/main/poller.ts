import { listProcesses } from "./process-source";
import type { ProcessRow } from "../shared/types";

/**
 * Refreshes the process snapshot on an interval, but only while the Activity
 * Monitor screen is actually open — `start()`/`stop()` are called from the
 * renderer's mount/unmount (via `ipc/handlers.ts`'s `start`/`stop` channels),
 * same lifecycle shape as `clipboard-history/main/poller.ts`'s `ClipboardPoller`,
 * so listing every running process a couple of times a second never happens
 * in the background while the launcher is just idling.
 */
export class QuitProcessPoller {
  private readonly onUpdate: (rows: ProcessRow[]) => void;
  private readonly intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(onUpdate: (rows: ProcessRow[]) => void, intervalMs = 3000) {
    this.onUpdate = onUpdate;
    this.intervalMs = intervalMs;
  }

  start(): void {
    if (this.timer) return;
    this.tick();
    // A quick follow-up tick shortly after the first one, so the icons that
    // finished resolving in the background from that first tick (see
    // `icon.ts`'s `cachedProcessIcon`) show up quickly rather than waiting
    // out a full `intervalMs`.
    setTimeout(() => this.tick(), 600);
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One refresh. Exposed so `list` can force an immediate snapshot without
   *  waiting for the next tick. Synchronous — see `process-source.ts`'s
   *  `listProcesses`. */
  tick(): ProcessRow[] {
    const rows = listProcesses();
    this.onUpdate(rows);
    return rows;
  }
}

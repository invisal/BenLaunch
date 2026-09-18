import { listProcesses } from "./process-source";
import type { ProcessRow } from "../shared/types";

/**
 * Refreshes the process snapshot on an interval, but only while the Quit
 * Processes screen is actually open — `start()`/`stop()` are called from the
 * renderer's mount/unmount (via `ipc/handlers.ts`'s `start`/`stop` channels),
 * same lifecycle shape as `clipboard-history/main/poller.ts`'s `ClipboardPoller`,
 * so listing every running process a couple of times a second never happens
 * in the background while the launcher is just idling.
 */
export class QuitProcessPoller {
  private readonly onUpdate: (rows: ProcessRow[]) => void;
  private readonly intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Pending one-shot timers (warm-up, icon follow-up), cleared by `stop()`. */
  private readonly pending = new Set<ReturnType<typeof setTimeout>>();
  private running = false;
  /** Last snapshot pushed, kept across `stop()` so the next visit can open on it. */
  lastRows: ProcessRow[] | null = null;

  constructor(onUpdate: (rows: ProcessRow[]) => void, intervalMs = 3000) {
    this.onUpdate = onUpdate;
    this.intervalMs = intervalMs;
  }

  /** A read whose result is thrown away: it sets the native CPU baseline and
   *  starts icon lookups, so a later first open finds both already warm. */
  prime(): void {
    listProcesses();
  }

  private later(fn: () => void, ms: number): void {
    const handle = setTimeout(() => {
      this.pending.delete(handle);
      fn();
    }, ms);
    this.pending.add(handle);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    // Native CPU% is a delta against the previous refresh. After the screen
    // has been closed for a while, the first read spans that whole gap and
    // reports nonsense — then the next tick reports real values and the list
    // reshuffles. So take a silent priming read (which also kicks off icon
    // resolution, see `icon.ts`'s `cachedProcessIcon`) and push the first
    // real snapshot a moment later.
    listProcesses();
    this.later(() => {
      this.tick();
      // Icons resolved in the background since the priming read.
      this.later(() => this.tick(), 1200);
      this.timer = setInterval(() => this.tick(), this.intervalMs);
    }, 600);
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const handle of this.pending) clearTimeout(handle);
    this.pending.clear();
  }

  /** One refresh. Exposed so `list` can force an immediate snapshot without
   *  waiting for the next tick. Synchronous — see `process-source.ts`'s
   *  `listProcesses`. */
  tick(): ProcessRow[] {
    const rows = listProcesses();
    this.lastRows = rows;
    this.onUpdate(rows);
    return rows;
  }
}

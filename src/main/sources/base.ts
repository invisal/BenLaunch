import type { IpcMain } from "electron";
import type { RequestSubtitleOptions } from "../../shared/types";
import type { ActionDefinition } from "../types";

/**
 * A provider of launcher actions. `actions.ts` holds a registry of these, fans
 * `provide()` out across all of them for every search, and routes execution to
 * whichever source `owns()` the chosen action id.
 *
 * Sources differ in how they produce actions — a static list, a cached list that
 * refreshes in the background, or (later) a list computed from the query itself —
 * but they share this contract so the registry doesn't care which kind it holds.
 */
export interface ActionSource {
  /** Stable identifier; also the conventional prefix of this source's action ids. */
  readonly id: string;

  /**
   * Actions to consider for `query`. List-then-filter sources ignore the argument
   * and return their whole catalog (the registry does the fuzzy match); a
   * query-driven source uses it to compute results.
   */
  provide(query: string): ActionDefinition[] | Promise<ActionDefinition[]>;

  /** Whether `actionId` belongs to this source. Usually an id-prefix check. */
  owns(actionId: string): boolean;

  /**
   * Resolve specific `actionId`s (already known, via `owns()`, to belong to
   * this source) back into full `ActionDefinition`s — e.g. a group's member
   * ids, looked up to render their live title/icon/subtitle. Optional: a
   * source that omits it is looked up via `provide("")` plus filtering
   * instead (see `resolveActionsByIds` in `actions.ts`), which is fine for a
   * source whose `provide()` is cheap and ignores its query argument, but a
   * query-driven source — whose `provide("")` isn't a meaningful "everything"
   * list — should implement this to stay resolvable by id.
   */
  provideByIds?(ids: string[]): ActionDefinition[] | Promise<ActionDefinition[]>;

  /**
   * Run the action identified by `actionId` (which this source `owns`). `query`
   * is the text in the search box at the moment of execution — query-driven
   * sources (e.g. quicklinks) parse their argument out of it; most sources
   * ignore it.
   */
  execute(actionId: string, query: string): void | Promise<void>;

  /** Warm-up hook, called once at startup. */
  init?(): void;

  /** Refresh hook, called when the launcher window is shown. */
  refresh?(): void;

  /**
   * Register this source's own `ipcMain` handlers against the given `ipc`,
   * called once at startup (after `init()`). Lets an `Extension` own its IPC
   * wiring end-to-end instead of `main/index.ts` importing and calling a
   * `register*Ipc` function per extension. `ipc` is injected (rather than the
   * source importing the `ipcMain` singleton itself) so handler registration
   * stays a plain, testable function of its inputs. Does not cover the
   * preload side — exposing a channel on `window.api` still means adding an
   * entry to `src/preload/index.ts`, since the preload script is a separate
   * bundle with no access to the main-process `Extension` instances.
   */
  registerIpc?(ipc: IpcMain): void;

  /**
   * Called when a row this source produced with `isDeferredSubtitle: true`
   * actually renders in the launcher (or the row asks to force-refresh, e.g.
   * a "Refresh" command), so the source can fetch/refresh its subtitle.
   * Resolves with the fresh subtitle — there is no separate push channel, this
   * return value IS how the renderer learns the new value. `opts.force` skips
   * any staleness cache and refetches unconditionally. Sources that never mark
   * a row `isDeferredSubtitle` can omit it.
   */
  requestSubtitle?(
    actionId: string,
    opts?: RequestSubtitleOptions,
  ): string | undefined | Promise<string | undefined>;
}

/**
 * Base for sources whose catalog is expensive to build and worth caching:
 *  - `fetch()` produces the authoritative list (e.g. by running a worker).
 *  - `loadStale()` optionally returns a persisted list so the first search after
 *    launch has something to show before `fetch()` finishes.
 *  - `refresh()` re-runs `fetch()`, throttled, so changes are picked up within a
 *    session without a restart.
 *
 * Execution resolves against the in-memory cache, so ids need no reverse-encoding.
 */
export abstract class CachedActionSource implements ActionSource {
  abstract readonly id: string;

  /** Minimum gap between `refresh()`-triggered fetches. */
  protected refreshThrottleMs = 30_000;

  private cached: ActionDefinition[] = [];
  private staleLoad: Promise<void> | null = null;
  private firstFetch: Promise<void> | null = null;
  private fetchInFlight: Promise<void> | null = null;
  private lastFetchAt = 0;

  /** Build the current, authoritative list. */
  protected abstract fetch(): Promise<ActionDefinition[]>;

  /** Load a persisted list for an instant cold start. Default: nothing persisted. */
  protected loadStale(): Promise<ActionDefinition[] | null> {
    return Promise.resolve(null);
  }

  init(): void {
    void this.ensureStale();
    if (!this.firstFetch) this.firstFetch = this.runFetch();
  }

  refresh(): void {
    this.init();
    if (Date.now() - this.lastFetchAt > this.refreshThrottleMs)
      void this.runFetch();
  }

  async provide(): Promise<ActionDefinition[]> {
    await this.ready();
    return this.cached;
  }

  owns(actionId: string): boolean {
    return actionId.startsWith(`${this.id}:`);
  }

  /** Direct lookup against the cache, once it's ready — no need to fall back to `provide("")`. */
  async provideByIds(ids: string[]): Promise<ActionDefinition[]> {
    await this.ready();
    const wanted = new Set(ids);
    return this.cached.filter((definition) => wanted.has(definition.action.id));
  }

  /** Wait until `cached` holds something worth reading: warmed stale/first-fetch. */
  private async ready(): Promise<void> {
    this.init();
    await this.ensureStale();
    // Nothing persisted (first launch ever) — wait for the fetch this once.
    if (this.cached.length === 0 && this.firstFetch) await this.firstFetch;
  }

  async execute(actionId: string, _query: string): Promise<void> {
    await this.cached
      .find((definition) => definition.action.id === actionId)
      ?.run();
  }

  private ensureStale(): Promise<void> {
    if (!this.staleLoad) {
      this.staleLoad = this.loadStale()
        .then((list) => {
          // A background fetch may have already produced a fresher list.
          if (list && this.cached.length === 0) this.cached = list;
        })
        .catch((error) => {
          console.error(`[${this.id}] stale load failed:`, error);
        });
    }
    return this.staleLoad;
  }

  /** Fetch now, ignoring the refresh throttle (still de-duplicated with an in-flight fetch). */
  protected runFetch(): Promise<void> {
    if (!this.fetchInFlight) {
      this.fetchInFlight = this.fetch()
        .then((list) => {
          // Keep the last known-good list if a fetch yields nothing (a failure).
          if (list.length > 0) this.cached = list;
          this.lastFetchAt = Date.now();
        })
        .catch((error) => {
          console.error(`[${this.id}] refresh failed:`, error);
        })
        .finally(() => {
          this.fetchInFlight = null;
        });
    }
    return this.fetchInFlight;
  }
}

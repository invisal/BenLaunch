import type { ProcessRow } from "./types";

export type SortBy = "cpu" | "memory";

/** One row of the list: a single process, or every process of one app
 *  (a browser and its helpers) rolled up into it. */
export interface ProcessItem {
  /** Stable across refreshes — `g:<appPath>` for anything with an app,
   *  `p:<pid>` otherwise — so the selection can follow it. */
  id: string;
  name: string;
  icon?: string;
  pids: number[];
  /** The one "Kill"/"Restart" act on; "Kill All" takes `pids`. */
  mainPid: number;
  cpuPercent: number;
  memoryBytes: number;
  path?: string;
  appPath?: string;
  /** Every listening TCP port across `pids`, ascending, deduplicated. */
  ports: number[];
}

/** Whether `query` names this item's port: `3000`, `:3000`, or a prefix of one
 *  (`30`). Anything that isn't all digits after an optional `:` never matches. */
export function matchesPort(item: ProcessItem, query: string): boolean {
  const digits = query.trim().replace(/^:/, "");
  return (
    /^\d+$/.test(digits) && item.ports.some((p) => String(p).startsWith(digits))
  );
}

function baseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function toItem(appPath: string | undefined, rows: ProcessRow[]): ProcessItem {
  const byPid = [...rows].sort((a, b) => a.pid - b.pid);
  // A bundle's own executable, not a helper inside `Contents/Frameworks`;
  // failing that (or off macOS) the oldest process.
  const main =
    byPid.find(
      (r) => appPath && r.path?.startsWith(`${appPath}/Contents/MacOS/`),
    ) ?? byPid[0];
  const bundleName = appPath?.endsWith(".app")
    ? baseName(appPath).slice(0, -".app".length)
    : undefined;
  return {
    id: appPath ? `g:${appPath}` : `p:${main.pid}`,
    name: bundleName ?? main.name,
    icon: rows.find((r) => r.icon)?.icon,
    pids: byPid.map((r) => r.pid),
    mainPid: main.pid,
    cpuPercent: rows.reduce((sum, r) => sum + r.cpuPercent, 0),
    memoryBytes: rows.reduce((sum, r) => sum + r.memoryBytes, 0),
    path: main.path,
    appPath,
    ports: [...new Set(rows.flatMap((r) => r.ports ?? []))].sort(
      (a, b) => a - b,
    ),
  };
}

/** Rolls `rows` into list items — grouped per app when `group` is on. */
export function buildItems(rows: ProcessRow[], group: boolean): ProcessItem[] {
  const groups = new Map<string, ProcessRow[]>();
  const items: ProcessItem[] = [];
  for (const row of rows) {
    if (group && row.appPath) {
      const members = groups.get(row.appPath);
      if (members) members.push(row);
      else groups.set(row.appPath, [row]);
    } else {
      items.push(toItem(undefined, [row]));
    }
  }
  for (const [appPath, members] of groups) items.push(toItem(appPath, members));
  return items;
}

const metric = (item: ProcessItem, sortBy: SortBy): number =>
  sortBy === "cpu" ? item.cpuPercent : item.memoryBytes;

function bySortDesc(sortBy: SortBy) {
  return (a: ProcessItem, b: ProcessItem) =>
    metric(b, sortBy) - metric(a, sortBy);
}

/**
 * Orders `fresh` for display. With `resort` it's a full sort by the metric;
 * without, every item already in `prev` keeps its slot (values update in
 * place), items that vanished drop out, and new ones are appended — so the
 * list doesn't reshuffle under a row the user is about to act on.
 */
export function arrange(
  prev: ProcessItem[] | null,
  fresh: ProcessItem[],
  sortBy: SortBy,
  resort: boolean,
): ProcessItem[] {
  if (resort || !prev) return [...fresh].sort(bySortDesc(sortBy));
  const byId = new Map(fresh.map((item) => [item.id, item]));
  const kept: ProcessItem[] = [];
  const seen = new Set<string>();
  for (const old of prev) {
    const item = byId.get(old.id);
    if (!item) continue;
    kept.push(item);
    seen.add(item.id);
  }
  const added = fresh
    .filter((item) => !seen.has(item.id))
    .sort(bySortDesc(sortBy));
  return [...kept, ...added];
}

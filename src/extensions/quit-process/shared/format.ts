/** Pure formatting helpers for the process list row (web-safe, no Electron). */

/** `"12.3% CPU"`, matching Activity Monitor's own precision. */
export function formatCpu(percent: number): string {
  return `${percent.toFixed(1)}% CPU`;
}

/** A byte count as `"340 MB"`/`"1.2 GB"` — processes are never small enough
 *  for KB/B to matter here, unlike `clipboard-history`'s `formatBytes`. */
export function formatMemory(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

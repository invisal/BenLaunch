/**
 * Resolves a process's executable path to an icon.
 *
 * macOS goes through `@main/native/apps-mac`'s `resolveIcon` — the same
 * `.icns`-in-the-bundle → `sips` → cached-PNG pipeline already used for the
 * installed-apps list and clipboard history's "source app" badge — rather
 * than Electron's own `app.getFileIcon`. `getFileIcon` looks like the
 * obvious choice (it's what `quicklink/main/file-icon.ts` uses for a
 * quicklink's target path) and does return a *non-empty* image for a
 * `.app` bundle, but that image is macOS's generic blank application icon,
 * not the bundle's real one — `getFileIcon`'s directory support turns out
 * not to resolve a bundle's actual `CFBundleIconFile` the way `NSWorkspace`
 * does. Windows/Linux executables don't have this problem (a `.exe`'s icon
 * is a resource on the file itself, which `getFileIcon` reads correctly),
 * so they still use it directly.
 *
 * Synchronous and cache-only from the caller's side (`cachedProcessIcon`
 * never awaits an OS lookup itself): a poll tick calls it for every row, and
 * an actual icon lookup is slow enough — and a typical process list long
 * enough (hundreds of rows) — that awaiting it inline was both the Activity
 * Monitor screen's initial-load stall and, every tick after, wasted work
 * re-fetching icons for processes whose icon never changes mid-session. A
 * cache miss instead kicks off resolution in the background and returns
 * `undefined` for *this* tick; the icon then just shows up on a later one
 * once resolved.
 */
import { app } from "electron";
import { resolveIcon as resolveMacAppIcon } from "@main/native/apps-mac";
import { outermostAppBundle } from "./app-bundle";

/** Resolved icons, keyed by the path actually looked up (see `iconTarget`).
 *  Failures are cached too (as `null`), so a path with no icon isn't retried
 *  every time it's seen. */
const cache = new Map<string, string | null>();
/** Plenty for a session's worth of distinct executables; stops the base64
 *  accumulating on a long-running launcher session. */
const MAX_ENTRIES = 500;
/** Paths currently being resolved, so a path several rows share in the same
 *  tick (or across back-to-back ticks before the first resolves) triggers
 *  only one `getFileIcon` call rather than one per row. */
const pending = new Set<string>();

/**
 * The path worth asking the OS for an icon on, or `null` if it isn't worth
 * asking at all. On macOS this is deliberately narrow — only a real `.app`
 * bundle has a meaningful custom icon; the vast majority of running
 * processes (daemons, helpers, CLI tools) are bare Unix executables, and
 * `getFileIcon` on one of those returns the same generic "unknown
 * executable" icon for all of them, which just reads as a blank white
 * square in the list rather than anything useful. Skipping those entirely
 * (no OS call at all) is most of what fixed the initial-load slowdown, since
 * a typical Mac's process list is hundreds of processes deep but only a
 * few dozen are real GUI apps. Windows executables carry their own
 * meaningful icon directly, so no such narrowing applies there.
 */
function iconTarget(execPath: string): string | null {
  return process.platform === "darwin"
    ? outermostAppBundle(execPath)
    : execPath;
}

async function fetchIcon(target: string): Promise<string | null> {
  if (process.platform === "darwin")
    return (await resolveMacAppIcon(target)) ?? null;
  const image = await app.getFileIcon(target, { size: "normal" });
  return image.isEmpty() ? null : image.toDataURL();
}

async function resolve(target: string): Promise<void> {
  let icon: string | null = null;
  try {
    icon = await fetchIcon(target);
  } catch {
    icon = null;
  }
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(target, icon);
}

/**
 * The icon for a process's executable path, as a `data:` URI, if already
 * resolved — `null` if it has none (or isn't worth resolving at all, or
 * `execPath` is absent), `undefined` if resolution just started and hasn't
 * finished yet.
 */
export function cachedProcessIcon(
  execPath: string | undefined,
): string | null | undefined {
  if (!execPath) return null;
  const target = iconTarget(execPath);
  if (!target) return null;

  const cached = cache.get(target);
  if (cached !== undefined) return cached;

  if (!pending.has(target)) {
    pending.add(target);
    void resolve(target).finally(() => pending.delete(target));
  }
  return undefined;
}

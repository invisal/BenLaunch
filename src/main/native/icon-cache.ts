/**
 * On-disk cache for the PNG bytes produced by the native icon extractors in
 * worker.ts. Icon extraction (PE resource parse + GDI draw + PNG encode, once
 * per installed app) dominates the cost of an app-list refresh, while the icons
 * themselves only change when the underlying executable is updated. File-backed
 * entries are keyed on their source file's mtime + size so such an update misses the
 * cache; packaged-app entries have no file to stat and instead expire by age. Any
 * entry not touched during a run is pruned, keeping the directory bounded to the
 * current set of installed apps.
 *
 * This runs inside worker.ts — plain Node under ELECTRON_RUN_AS_NODE, with no
 * access to Electron's `app` — so the cache directory is handed in by apps.ts via
 * the BENPOCKET_ICON_CACHE_DIR env var. When it is unset every operation no-ops.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Packaged icons re-extract after this long even without a detectable change. */
export const PACKAGED_TTL_MS = 7 * 24 * 60 * 60 * 1000

const cacheDir = process.env.BENPOCKET_ICON_CACHE_DIR

/** Keys read or written this run; everything else is prune-eligible. */
const touched = new Set<string>()
let dirReady = false

function ensureDir(): string | null {
  if (!cacheDir) return null
  if (!dirReady) {
    try {
      mkdirSync(cacheDir, { recursive: true })
      dirReady = true
    } catch (error) {
      console.error('[icon-cache] Failed to create cache directory:', error)
      return null
    }
  }
  return cacheDir
}

function sha1(material: string): string {
  return createHash('sha1').update(material).digest('hex')
}

/**
 * Key for a file-backed icon (an .exe/.dll/.lnk resource). Returns `null` when the
 * source file can't be stat'd, which disables caching for that icon rather than
 * risking a stale hit. `mtimeMs` + `size` change when an installer rewrites the file.
 */
export function fileKey(sourcePath: string, index: number): string | null {
  try {
    const stat = statSync(sourcePath)
    return sha1(`${sourcePath.toLowerCase()}|${index}|${stat.mtimeMs}|${stat.size}`)
  } catch {
    return null
  }
}

/** Key for a packaged (MSIX/UWP) icon, which comes from a shell item with no file. */
export function packagedKey(appId: string): string {
  return sha1(`pkg|${appId.toLowerCase()}`)
}

/**
 * Returns the cached PNG for `key`, or `null` on a miss. Marks `key` as touched even
 * on a miss so a subsequent `write(key, ...)` survives the prune. `maxAgeMs` expires
 * entries whose file is older than that (used for packaged icons).
 */
export function read(key: string | null, maxAgeMs?: number): Buffer | null {
  if (!key) return null
  const dir = ensureDir()
  if (!dir) return null
  touched.add(key)
  const file = join(dir, `${key}.png`)
  try {
    if (maxAgeMs !== undefined && Date.now() - statSync(file).mtimeMs > maxAgeMs) return null
    return readFileSync(file)
  } catch {
    return null
  }
}

export function write(key: string | null, png: Buffer): void {
  if (!key) return
  const dir = ensureDir()
  if (!dir) return
  touched.add(key)
  try {
    writeFileSync(join(dir, `${key}.png`), png)
  } catch (error) {
    console.error('[icon-cache] Failed to write entry:', error)
  }
}

/** Deletes every cached PNG not read or written this run. */
export function prune(): void {
  const dir = ensureDir()
  if (!dir) return
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (!entry.endsWith('.png') || touched.has(entry.slice(0, -4))) continue
    try {
      unlinkSync(join(dir, entry))
    } catch {
      /* a concurrent run may have removed it already */
    }
  }
}

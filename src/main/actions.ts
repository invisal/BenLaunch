import type { LauncherAction } from '../shared/types'
import { fuzzyMatch } from './search'
import type { ActionSource } from './sources/base'
import { InstalledAppSource } from './sources/apps/source'
import { BuiltinCommandSource } from './sources/builtin/source'

/**
 * Registry of action sources. Order matters: `searchActions` keeps it, and the
 * stable sort below preserves it among equally-scored results (so built-in
 * commands rank ahead of applications on a tie).
 */
const sources: ActionSource[] = [new BuiltinCommandSource(), new InstalledAppSource()]

/** Warm every source at startup (called from app `whenReady`). */
export function initActionSources(): void {
  for (const source of sources) source.init?.()
}

/** Refresh every source (called when the launcher window is shown; sources throttle). */
export function refreshActionSources(): void {
  for (const source of sources) source.refresh?.()
}

export async function searchActions(query: string): Promise<LauncherAction[]> {
  const lists = await Promise.all(sources.map((source) => source.provide(query)))
  const definitions = lists.flat()

  const trimmed = query.trim()
  if (!trimmed) {
    return definitions.map((definition) => definition.action)
  }

  return definitions
    .map((definition) => {
      const result = fuzzyMatch(trimmed, definition.action.title)
      return { action: definition.action, matched: result.match, score: result.score }
    })
    .filter((entry) => entry.matched)
    // Best score first; `sort` is stable, so equal scores keep registry order.
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.action)
}

export async function executeAction(id: string): Promise<void> {
  await sources.find((source) => source.owns(id))?.execute(id)
}

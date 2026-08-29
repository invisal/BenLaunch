import type { ActionDefinition } from '../../types'
import { CachedActionSource } from '../base'
import { getInstalledApplications, mapWorkerResult } from './apps'
import { readAppsCache } from './cache'

/**
 * Installed Windows applications — Start Menu shortcuts (`app:` ids) and packaged
 * apps (`pkg:` ids). The list comes from worker.ts, which is slow to run cold, so
 * it's seeded from the on-disk cache (see cache.ts) and refreshed in the
 * background at startup and whenever the launcher is shown.
 */
export class InstalledAppSource extends CachedActionSource {
  readonly id = 'app'

  owns(actionId: string): boolean {
    return actionId.startsWith('app:') || actionId.startsWith('pkg:')
  }

  protected fetch(): Promise<ActionDefinition[]> {
    return getInstalledApplications()
  }

  protected async loadStale(): Promise<ActionDefinition[] | null> {
    const cached = await readAppsCache()
    return cached ? mapWorkerResult(cached) : null
  }
}

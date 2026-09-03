import type { ActionDefinition } from '../../../types.ts'
import { CachedActionSource } from '../../base.ts'
import type { RatesData } from './cache.ts'
import { fetchRates } from './fetch.ts'
import { setCurrentRates } from './store.ts'

/** Rates only move once a day; re-fetch at most every 6 hours. */
const REFRESH_THROTTLE_MS = 6 * 60 * 60 * 1000

/**
 * Live currency exchange rates for the calculator's `currency` evaluator.
 *
 * It's a `CachedActionSource` so it rides the launcher's existing source
 * lifecycle — `initActionSources()` warms it, `refreshActionSources()` re-fetches
 * it (throttled) on every launcher show — but it contributes **no actions**:
 * `fetch()` pushes the fresh rates into `store.ts` and returns an empty list.
 * The evaluator reads `currentRates()` from that store, synchronously.
 *
 * Modelled on `InstalledAppSource`; `fetch()` is the expensive call, the base
 * handles staleness and de-duplication.
 */
export class ExchangeRateSource extends CachedActionSource {
  readonly id = 'exchange-rate'
  protected refreshThrottleMs = REFRESH_THROTTLE_MS

  private readonly fetcher: () => Promise<RatesData>

  /** `fetcher` is injectable for tests; the app uses the real network fetch. */
  constructor(fetcher: () => Promise<RatesData> = fetchRates) {
    super()
    this.fetcher = fetcher
  }

  /** This source is a rate feed, not an action provider. */
  provide(): Promise<ActionDefinition[]> {
    return Promise.resolve([])
  }

  owns(): boolean {
    return false
  }

  protected async fetch(): Promise<ActionDefinition[]> {
    setCurrentRates(await this.fetcher())
    return []
  }
}

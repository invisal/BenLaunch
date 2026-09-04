import type { RatesData } from './cache.ts'

/**
 * Live exchange rates. `open.er-api.com` is key-less, 166 currencies, updated
 * daily. Not unit-tested (network); `ExchangeRateSource` takes it as an
 * injectable so its logic can be.
 */
const ENDPOINT = 'https://open.er-api.com/v6/latest/USD'
const TIMEOUT_MS = 10_000

interface ErApiResponse {
  result: string
  base_code: string
  time_last_update_unix: number
  rates: Record<string, number>
}

export async function fetchRates(): Promise<RatesData> {
  const res = await fetch(ENDPOINT, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`exchange-rate: HTTP ${res.status}`)

  const json = (await res.json()) as ErApiResponse
  if (json.result !== 'success' || typeof json.rates?.USD !== 'number') {
    throw new Error('exchange-rate: unexpected payload')
  }

  return {
    base: json.base_code || 'USD',
    asOf: new Date(json.time_last_update_unix * 1000).toISOString().slice(0, 10),
    rates: json.rates,
  }
}

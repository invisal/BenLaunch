# `exchange-rate` source

Live currency exchange rates for the calculator's
[`currency` evaluator](../../../calculator/evaluators/currency/).

| File | Role |
|---|---|
| [source.ts](source.ts) | `ExchangeRateSource extends CachedActionSource` — rides the source lifecycle, contributes no actions; `fetch()` calls the network and pushes rates into `store.ts` |
| [store.ts](store.ts) | `currentRates()` / `setCurrentRates()` — the process-wide in-memory table (live > disk > seed), read by the evaluator |
| [cache.ts](cache.ts) | `readRatesCache(dir)` / `writeRatesCache(dir, snap)` — `userData/exchange-rates.json`, `CACHE_VERSION`, atomic |
| [fetch.ts](fetch.ts) | `fetchRates()` — `open.er-api.com`, key-less, 166 currencies, 10 s timeout |
| [seed.ts](seed.ts) | `RATES_SEED` — bundled snapshot so conversion works before the first fetch |

## How it plugs in

- `new ExchangeRateSource()` sits in the `sources` array in
  [actions.ts](../../../actions.ts) alongside `InstalledAppSource` etc.
- The base `CachedActionSource` handles warm-up (`init()`), throttled refresh
  (`refresh()`, 6 h here) and de-duplication. `fetch()` is the only thing this
  class adds: `setCurrentRates(await fetchRates())`, return `[]`.
- The `currency` evaluator imports `currentRates()` from `store.ts` — never the
  source class — and reads it synchronously on every keystroke.
- `store.ts` resolves `userData` lazily (`createRequire`), so it (and therefore
  the evaluator) is importable outside Electron for tests.

## Tests

`cache.ts` and `store.ts` are dependency-injected and table-tested;
`source.test.ts` checks the class contributes no actions and that a fetch lands
in the store. `fetch.ts` (network) is not unit-tested.

```bash
node --test "src/main/sources/calculator/exchange-rate/**/*.test.ts"
```

## Refreshing the seed

`seed.ts` is a hand-committed snapshot from `open.er-api.com/v6/latest/USD`.

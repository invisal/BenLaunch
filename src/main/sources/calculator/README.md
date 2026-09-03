# `sources/calculator/`

Data sources for the **calculator** rather than the action list — external data
an [evaluator](../../calculator/evaluators/) needs but can't compute (exchange
rates today; time-zone / city tables, crypto prices later).

They're still `ActionSource`s so they ride the existing lifecycle in
[actions.ts](../../actions.ts) — `initActionSources()` warms them,
`refreshActionSources()` refreshes them (throttled) on every launcher show — but
they contribute **no actions**: `provide()` returns `[]`. The fetched data is
handed to a small module-level store that the evaluator reads synchronously.

| Source | Feeds | Data |
|---|---|---|
| [exchange-rate/](exchange-rate/) | `currency` evaluator | fiat rates from open.er-api.com |

## Adding one

1. `sources/calculator/<name>/source.ts` — `class <Name>Source extends CachedActionSource`,
   `provide()` → `[]`, `owns()` → `false`, `fetch()` does the work and updates a
   `store.ts` module singleton.
2. `cache.ts` (dir-injected read/write, tested) + `store.ts` (the in-memory
   copy + lazy `userData` resolution, so the evaluator can import it) + `fetch.ts`.
3. `new <Name>Source()` in the `sources` array in [actions.ts](../../actions.ts).

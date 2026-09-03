# Calculator evaluators

Each folder here is one **compute engine**. The pipeline
([../index.ts](../index.ts)) normalises the query once, then offers it to each
evaluator in priority order; the first to return a non-null `Calculation` wins.

An evaluator implements [`Evaluator`](../types.ts):

```ts
interface Evaluator {
  readonly id: string
  evaluate(input: string): Calculation | null   // input is already normalised
}
```

**Detection is the evaluator's own job.** There is no central "what kind is
this?" classifier — real input is ambiguous (`5 m` = metres or May? `march 5` vs
`5 - 3`). Each evaluator's parser decides whether the input is its kind and
returns `null` otherwise. Priority order settles the genuine clashes.

## Planned evaluators

Derived from the feature research in
[pere-doc/calculation/](../../../../pere-doc/calculation/) (24 Raycast features →
5 engines). Priority ≈ "try this before the more permissive ones".

| Priority | Evaluator | Status | Covers (research #) | Engine | Async? |
|:--:|---|:--:|---|---|:--:|
| 1 | `timezone/` | ⬜ | current time in a place (7), convert a time (8), time diff between places (18) | `Intl` + bundled IANA/city data | no |
| 2 | `datetime/` | ⬜ | relative dates (12), date diff & countdown (10), add time to a date (17), ISO-8601 timestamps (23), duration ↔ timespan (16), work-hours / work-days (24) | `chrono-node` + calendar helpers | no |
| 3 | `currency/` | ⬜ | fiat conversion (3), crypto conversion (19), shorthand `USD1K` | rate table cached in `userData/*.json` + a fetch | **yes** |
| 4 | `units/` | ⬜ | automatic unit conversion (9), design px @ ppi (21) | `mathjs` units + a counterpart-unit map | no |
| 5 | `math/` | ✅ | arithmetic (1), functions & trig (11), explicit unit conversion (4), percentages (5), discount / tip / markup (14), ratio (22), rate-bearing math (20) | `mathjs` | no |

`math` is last because it's the most permissive — `mathjs` will happily read
`USD` as an undefined symbol and throw, so currency has to look first.

## Not evaluators

These research features are UI / storage, not compute — they live in the
renderer and a store module, not here:

- **Calculator history** (6) and **pinned calculations** (15) — a persisted store
  (mirror [src/main/usage/store.ts](../../usage/store.ts)) + a renderer surface.
- **Clipboard actions & shortcuts** (2) — [App.tsx](../../../renderer/src/screens/launcher/App.tsx)
  key handling + the actions menu.
- **Number formatting & localization** (13) — a shared formatting concern; when a
  second evaluator needs it, extract a `formatNumber` helper up to `calculator/`.

## Adding one

1. `evaluators/<id>/index.ts` exporting `export const <id>: Evaluator`.
2. `evaluators/<id>/<step>.ts` modules + a `*.test.ts` for each, plus an
   `index.test.ts` for the evaluator end-to-end.
3. A `README.md` (feature description + every supported use case with examples —
   see [math/README.md](math/README.md)).
4. Register it in the `evaluators` array in [../index.ts](../index.ts) at the
   right priority.
5. If it does I/O, make `Evaluator.evaluate` return
   `Calculation | null | Promise<Calculation | null>` and `await` in the pipeline
   — `actions.ts` already awaits `evaluate()`.

# `timezone` evaluator

Current time in a place, and converting a specific time between places. Last
evaluator in the calculator pipeline ([../../index.ts](../../index.ts)) — by
the time it runs, `math`/`currency`/`datetime` have already claimed anything
they understood.

Input arrives already framed by the shared
[calculator/normalize.ts](../../normalize.ts) — the "what is …" lead-in and any
trailing `=` / `equals` / `?` are gone before this evaluator runs.

## How it works

```
input ─▶ cheap gate ─▶ convert ─▶ clock ─▶ Calculation
         ("time" or a   (5pm ldn   (time in
          time token)     in sf)    Tokyo)
```

| Module                   | Responsibility                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| [places.ts](places.ts)   | Bundled city/abbreviation/airport table + `resolvePlace` (exact/alias, then a length-gated fuzzy fallback) |
| [time.ts](time.ts)       | Minimal time-of-day parser: `5pm`, `9:30am`, `17:00`, `noon`, `midnight`                                   |
| [clock.ts](clock.ts)     | "current time in a place"                                                                                  |
| [convert.ts](convert.ts) | "convert a specific time" between places, via `date-fns-tz`                                                |
| [format.ts](format.ts)   | Shared offset/clock/weekday/calendar-date formatting                                                       |
| [index.ts](index.ts)     | Wires the above into the `Evaluator`, tries `convert` (more specific) then `clock`                         |

Unlike `math`/`currency`/`datetime`, this evaluator needs a proper
zoned-time library: turning "5pm in London" into an absolute instant requires
knowing London's DST rules for that particular day, which has no clean built-in
JS primitive. [`date-fns-tz`](https://github.com/marnusw/date-fns-tz) (MIT,
pure JS) provides `fromZonedTime` / `formatInTimeZone` for this.

## The place dataset ([places.ts](places.ts))

A **hand-curated table** of ~150 entries (major world cities + common
abbreviations `sf`/`nyc`/`ldn`/`la`/`blr`/… + a handful of busy airport codes),
not an exhaustive geo dataset — that would mean bundling a few thousand rows
from GeoNames/OurAirports. This covers the large majority of realistic
"time in X" queries; extend the table as gaps show up.

`resolvePlace` is accent-insensitive ("São Paulo" and "sao paulo" hit the same
entry) and falls back to the app's own `fuzzyMatch`
([search.ts](../../../search.ts)) for a partially-typed name — but only for
inputs **3+ characters**. A 2-letter needle (`ft`, `in`, `kg`) is trivially a
subsequence of countless city names (`frankfurt` contains `f`…`t`) and would
otherwise turn ordinary unit abbreviations into bogus place matches; every
real alias this short (`sf`, `la`, `kl`) is already in the exact-match table,
so the cutoff costs nothing for legitimate input.

## Supported use cases

### 1. Current time in a place ([clock.ts](clock.ts))

| Query                       | Result          |
| --------------------------- | --------------- |
| `time in Tokyo`             | `21:00 · GMT+9` |
| `time at sf`                | `05:00 · GMT-7` |
| `what time is it in Berlin` | `14:00 · GMT+2` |
| `Tokyo time`                | `21:00 · GMT+9` |

The weekday is appended only when the target's calendar date differs from the
viewer's own — e.g. `time in Auckland` shows `03:00 Tue · GMT+12` when it's
still Monday locally.

The trailing-`time` shape (`Tokyo time`) resolves the place by **exact/alias
match only** — no fuzzy fallback — since this phrasing is common enough in
ordinary text ("lunch time", "party time") that a fuzzy place match would risk
false positives.

### 2. Convert a specific time ([convert.ts](convert.ts))

| Query                  | Result                 |
| ---------------------- | ---------------------- |
| `5pm ldn in sf`        | `09:00 Mon`            |
| `9:30am NYC to Berlin` | `15:30 Mon`            |
| `noon Tokyo in London` | `04:00 Mon`            |
| `midnight UTC in LA`   | `17:00 Sun (prev day)` |

The source is **today's date in the source zone** unless the query gives one;
a bare time with no source place (`midnight in LA`) defaults to the system's
own zone. `(next day)` / `(prev day)` is appended when the destination's
calendar date differs from the source's.

## Not claimed (returns `null` → next evaluator / action search)

| Query                                        | Why                                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `chrome`, `5 + 3`                            | no "time" and no leading time-of-day token — rejected by the cheap gate                 |
| `lunch time`, `party time`                   | "lunch"/"party" don't resolve to a known place (and `<place> time` doesn't fuzzy-match) |
| `5 in ft`                                    | "ft" isn't a resolvable place, and it's too short for the fuzzy fallback anyway         |
| `time in nowhere-at-all`                     | not in the place table, and not a close enough fuzzy match                              |
| `10 usd to eur`, `10 ft to m`, `35 days ago` | claimed earlier by `currency` / `math` / `datetime`; `timezone` never even sees them    |

## Testing note: the "local zone"

Both `resolveClock` and `resolveConvert` take an optional `localZone`
parameter (defaults to `Intl.DateTimeFormat().resolvedOptions().timeZone`,
i.e. the system's own) — it's the "viewer's day" the weekday-append rule
compares against, and the default source zone for a bare time with no source
place. Tests pass an explicit zone (`'UTC'`) so results don't depend on the
timezone of whatever machine runs them.

## Tests

Each module has a `*.test.ts`; [index.test.ts](index.test.ts) drives the
evaluator end-to-end with an injected clock and local zone
(`createTimezoneEvaluator(() => fixedDate, () => 'UTC')`, same pattern as
`currency`'s `createCurrencyEvaluator` / `datetime`'s
`createDatetimeEvaluator`). Full-pipeline cases (framing, chain fall-through)
live in [../../index.test.ts](../../index.test.ts).

```bash
node --test "src/main/calculator/**/*.test.ts"
```

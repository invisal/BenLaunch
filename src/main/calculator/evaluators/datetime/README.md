# `datetime` evaluator

Relative dates, countdowns, and date differences, built on
[`chrono-node`](https://github.com/wanasit/chrono) (MIT, pure JS) for natural-
language date parsing. Third evaluator in the calculator pipeline
([../../index.ts](../../index.ts)), tried after `math` and `currency`.

Input arrives already framed by the shared
[calculator/normalize.ts](../../normalize.ts) — the "what is …" lead-in and any
trailing `=` / `equals` / `?` are gone before this evaluator runs.

## How it works

```
input ─▶ gate ─▶ countdown ─▶ difference ─▶ relative ─▶ Calculation
         (cheap    (until/     (between…    (chrono
          keyword    left in)   and, A to B)  fallback)
          filter)
```

| Module                         | Responsibility                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| [gate.ts](gate.ts)             | `looksLikeDate` — cheap keyword pre-filter so `chrono` only runs on plausible candidates                  |
| [countdown.ts](countdown.ts)   | `days until X`, `weeks left in the quarter` — a duration, not a date                                      |
| [difference.ts](difference.ts) | `days between A and B`, `A to B` — both sides must independently parse as dates                           |
| [relative.ts](relative.ts)     | Everything else: `tomorrow`, `35 days ago`, `monday in 3 weeks`, business days, ordinal period boundaries |
| [period.ts](period.ts)         | Shared quarter/year/month/week boundary math (no library)                                                 |
| [format.ts](format.ts)         | `formatDate` (`"17 May"` / `"17 May 2028"`) and `formatDuration` (`"243 days"`, auto-unit)                |
| [index.ts](index.ts)           | Wires the above into the `Evaluator`, tries `countdown` → `difference` → `relative`                       |

`countdown`/`difference` claim only their specific shapes
(`until`/`till`/`to`, `between … and …`); `relative`'s `chrono.parse` fallback
is the most permissive, so it requires the match to span the _entire_ input —
see "Not claimed" below for why.

## Supported use cases

### 1. Relative dates ([relative.ts](relative.ts))

| Query               | Result        |
| ------------------- | ------------- |
| `tomorrow`          | `Sun, Sep 6`  |
| `35 days ago`       | `Sat, Aug 1`  |
| `monday in 3 weeks` | `Sat, Sep 26` |
| `2 weeks from now`  | `Sat, Sep 19` |
| `next friday`       | `Fri, Sep 11` |
| `last friday`       | `Fri, Sep 4`  |

**Business days** — `chrono` has no concept of these, so it's hand-rolled
(step day-by-day, skip Sat/Sun):

| Query                 | Result                               |
| --------------------- | ------------------------------------ |
| `in 10 business days` | _(steps forward, skipping weekends)_ |

**Ordinal period boundaries** — `chrono` resolves "first day of next month"
to the _5th_ of next month (it keeps today's day-of-month rather than
snapping to day 1), so this is also hand-rolled via [period.ts](period.ts):

| Query                     | Result                     |
| ------------------------- | -------------------------- |
| `first day of next month` | the 1st of next month      |
| `last day of this month`  | the last day of this month |
| `first day of the year`   | 1 Jan                      |

**`last <weekday>` vs. bare `<weekday>`.** `chrono`'s `forwardDate` option
applies uniformly to the whole string, which — undocumented quirk — pushes an
_explicit_ `last friday` into the future too if set. So `forwardDate` is only
`true` when the query doesn't contain `last`; a bare `friday` still resolves
to the next occurrence (`forwardDate: true`), matching Raycast's "next
occurrence, today counts" rule, while `last friday` stays in the past.

### 2. Countdowns ([countdown.ts](countdown.ts))

| Query                      | Result                                 |
| -------------------------- | -------------------------------------- |
| `days until 25 Dec`        | `111 days`                             |
| `weeks until 2026-12-01`   | _(in weeks)_                           |
| `days left in the quarter` | days to the end of the current quarter |
| `days left in the year`    | days to 31 Dec                         |

A target already in the past (`days until 1 Jan 2020`) returns `null` rather
than a negative countdown.

### 3. Date differences ([difference.ts](difference.ts))

| Query                                    | Result                                    |
| ---------------------------------------- | ----------------------------------------- |
| `days between 1 Jan and 1 Apr`           | `90 days`                                 |
| `days between 2024-01-15 and 2024-06-30` | `167 days`                                |
| `1990-05-01 to today`                    | `436 months` (no unit given → auto-picks) |

**Month-day season chaining.** A date like `1 Jan` with no year resolves to
_whichever_ year `chrono` thinks is nearest to "now" — independently for each
side of a `between A and B`, which can put two dates that are meant to sit in
the same season a year apart (`1 Jan` → next year, `15 Mar` → this year,
455 days apart instead of 73). When the naive parse comes out backwards
(`right < left`), the right side is re-parsed relative to the _left_ side
instead of "now", which fixes this for the common case without needing a
whole date-range grammar.

**Bare `A to B`.** Guarded by requiring _both_ sides to independently parse as
real dates via `chrono` — confirmed safe against ordinary phrases like
`flight to paris` or `message to bob` (neither side parses), on top of running
after `math`/`currency` in the pipeline (so `10 ft to m` / `10 usd to eur` are
already claimed by the time this evaluator gets a turn).

### 4. Auto-picked duration units ([format.ts](format.ts))

When a query doesn't name a unit (`1990-05-01 to today`, `between A and B`),
`formatDuration` auto-picks: days under 8 weeks, then weeks, then months.

## Not claimed (returns `null` → next evaluator / action search)

| Query                                    | Why                                                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `chrome`, `photoshop`, `5 + 3`           | no date keyword — rejected by the cheap gate before `chrono` even runs                                                  |
| `today's news`                           | `chrono` only matches "today" — a _partial_ match of the input, not the whole query, so it's left for the action search |
| `monday.com`                             | same — `chrono` matches "monday", not the whole string; the real app can still be found                                 |
| `flight to paris`, `message to bob`      | neither side of `to` parses as a date                                                                                   |
| `5 to 10`, `9 to 5`                      | ditto — bare numbers aren't dates                                                                                       |
| `10 usd to eur`, `10 ft to m`, `5 in ft` | claimed earlier by `currency` / `math`; `datetime` never even sees them                                                 |

## Tests

Each module has a `*.test.ts`; [index.test.ts](index.test.ts) drives the
evaluator end-to-end with an injected clock
(`createDatetimeEvaluator(() => fixedDate)`, same pattern as `currency`'s
`createCurrencyEvaluator`). Full-pipeline cases (framing, chain fall-through)
live in [../../index.test.ts](../../index.test.ts).

```bash
node --test "src/main/calculator/**/*.test.ts"
```

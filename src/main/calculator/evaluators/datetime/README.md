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
input ─▶ gate ─▶ countdown ─▶ difference ─▶ arithmetic ─▶ relative ─▶ Calculation
         (cheap    (until/     (between…    (date/time    (chrono
          keyword    left in)   and, A to B)  ± N unit)     fallback)
          filter)
```

| Module                         | Responsibility                                                                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [gate.ts](gate.ts)             | `looksLikeDate` — cheap keyword pre-filter so `chrono` only runs on plausible candidates                                                                                               |
| [countdown.ts](countdown.ts)   | `days until X`, `weeks left in the quarter` — a duration, not a date                                                                                                                   |
| [difference.ts](difference.ts) | `days between A and B`, `A to B` — both sides must independently parse as dates                                                                                                        |
| [arithmetic.ts](arithmetic.ts) | `<date-or-time> ± <n> [unit]` — `August 5 + 5`, `3:45pm + 90 min`, `2026-01-15 + 3 weeks`                                                                                              |
| [relative.ts](relative.ts)     | Everything else: `tomorrow`, `35 days ago`, `monday in 3 weeks`, business days, ordinal period boundaries                                                                              |
| [period.ts](period.ts)         | Shared quarter/year/month/week boundary math (no library)                                                                                                                              |
| [format.ts](format.ts)         | `formatDate` (`"17 May"` / `"17 May 2028"`), `formatDateTime` (adds `"4:00 PM"`), `formatTimeOfDay` (`"8:45 PM"`), `formatDuration` (`"243 days"` / `"9 hours 45 minutes"`, auto-unit) |
| [index.ts](index.ts)           | Wires the above into the `Evaluator`, tries `countdown` → `difference` → `arithmetic` → `relative`                                                                                     |

`countdown`/`difference`/`arithmetic` claim only their specific shapes
(`until`/`till`/`to`, `between … and …`, an explicit `±` operator whose left
side parses in full as a date/time); `relative`'s `chrono.parse` fallback
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

Phrases that carry a **time-of-day** (`now + 90 min`, `in 3 hours`,
`tomorrow at 5pm`) resolve to an exact moment and are shown to the minute
(`Sat, Sep 5, 11:30 AM`; `rawValue` `2026-09-05 11:30`) instead of collapsing
to a bare calendar day. The discriminator is `chrono`'s
`result.start.isCertain('hour')`.

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

Two shapes — `<unit> until|till|to <target>` and `<unit> left in [the]
<period>` — where `<unit>` is `days`/`weeks`/`months` (`until` also takes
`hours`) and `<period>` is `quarter`/`year`/`month`/`week`. The result is a
duration, not a date.

| Query                      | Result                                 |
| -------------------------- | -------------------------------------- |
| `days until 25 Dec`        | `111 days`                             |
| `days till 25 Dec`         | same — `until` / `till` / `to`         |
| `weeks until 2026-12-01`   | _(in weeks)_                           |
| `hours until midnight`     | `14 hours`                             |
| `days left in the quarter` | days to the end of the current quarter |
| `weeks left in the month`  | _(in weeks)_                           |
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
`formatDuration` auto-picks: a sub-day span is shown to the minute
(`now until 9AM` → `9 hours 45 minutes`, `now to 10:30` → `30 minutes`), then
days under 8 weeks, then weeks, then months. A short side like `9AM` that
lands behind `now` is re-resolved _forward_ (tomorrow 9AM), so a late-night
`now until 9AM` counts down to the coming morning, not the past one.

### 5. Date & time arithmetic ([arithmetic.ts](arithmetic.ts))

`<date-or-time> <+ | - | plus | minus> <n> [unit]` — add or subtract a span
from a date or a clock time. The left side is parsed by `chrono` and must span
the whole operand (so `5 + 3` — nothing parses — is left to `math`).
[`date-fns`](https://date-fns.org)' `add` does the math, so month/year steps
stay calendar-correct.

**Unit inference** — Raycast's rule: a bare number is **days** after a date,
**hours** after a clock time. An explicit unit token always wins.

| Query                  | Result                 | Why                                    |
| ---------------------- | ---------------------- | -------------------------------------- |
| `August 5 + 5`         | `Mon, Aug 10`          | bare number after a date ⇒ days        |
| `August 5 - 3`         | `Sun, Aug 2`           | subtraction                            |
| `August 5 minus 3`     | `Sun, Aug 2`           | the `plus`/`minus` word works too      |
| `3:45pm + 5`           | `8:45 PM`              | bare number after a clock time ⇒ hours |
| `3:45pm - 2`           | `1:45 PM`              |                                        |
| `3:45pm + 90 min`      | `5:15 PM`              | explicit unit                          |
| `14:30 + 90 min`       | `4:00 PM`              | 24-hour input, 12-hour output          |
| `9:00 + 8h`            | `5:00 PM`              | `h` abbreviation                       |
| `2026-01-15 + 3 weeks` | `Thu, Feb 5`           |                                        |
| `2026-01-15 + 2w`      | `Thu, Jan 29`          | `w` abbreviation                       |
| `2026-01-31 + 1 month` | `Sat, Feb 28`          | calendar-correct clamp                 |
| `2026-01-15 + 1 year`  | `Fri, Jan 15, 2027`    | year shown when it differs from now    |
| `today - 10 days`      | `Wed, Aug 26`          |                                        |
| `now + 90 min`         | `Sat, Sep 5, 11:30 AM` | `now` keeps its calendar date          |
| `11pm + 3h`            | `2:00 AM (next day)`   | clock result flags a midnight crossing |
| `1am - 2h`             | `11:00 PM (prev day)`  |                                        |

**Unit tokens** (case-insensitive): `s`/`sec`/`second(s)`, `m`/`min`/`minute(s)`,
`h`/`hr`/`hour(s)`, `d`/`day(s)`, `w`/`wk`/`week(s)`, `mo`/`month(s)`,
`y`/`yr`/`year(s)`. Note `m` is **minutes** (`5pm + 30m`) — months need `mo` or
longer.

**Output form.** A pure clock time in ⇒ a pure clock time out
(`formatTimeOfDay`, `"8:45 PM"`), with a `(next day)` / `(in 2 days)` /
`(prev day)` hint when it crossed midnight. Anything anchored to a real
calendar date (`now`, `today`, `August 5`, an ISO date) keeps the date —
`formatDate`, or `formatDateTime` when a time is involved.

Runs _before_ `relative`, so it claims the explicit-`±` shapes rather than
leaning on `chrono`'s own (non-calendar-correct) offset handling.
`timezone`'s `time in Tokyo + 6 hours` is the same idea applied to a place —
see [../timezone/README.md](../timezone/README.md) §2.

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

# Calculator evaluators

The calculator pipeline ([../index.ts](../index.ts)) tries each `Evaluator`
below in order and takes the first non-null `Calculation`. Detection is not a
separate classifier — each evaluator's own parser decides whether the input is
"its kind" and returns `null` otherwise, so order only matters for the
ambiguous cases (a fail-fast evaluator earlier in the list is harmless; see
each evaluator's own README for why its position is safe).

```
const evaluators = [timespan, finance, ratio, pixels, math, currency, datetime, timezone]
```

The four keyword-gated phrase evaluators run before `math`, which would
otherwise mangle them (`16:9`, `1h 30m + 45m`, `20% off 80`, `12pt in px`).
[`../routing.test.ts`](../routing.test.ts) pins every hand-off, including
bare trigger words (`ratio`, `tip`, `time`) that must fall through to search.

Backed by research in [pere-doc/calculation/](../../../../pere-doc/calculation/)
(gitignored) — 24 Raycast calculator features.

| Evaluator             | Status | Feature #s (see pere-doc)                                                                                                                                |
| --------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [timespan](timespan/) |   ✅   | 16 — break down / add / convert durations                                                                                                                |
| [finance](finance/)   |   ✅   | 14 — discount, tip, markup/margin, VAT; 20 — interest & growth                                                                                           |
| [ratio](ratio/)       |   ✅   | 22 — simplify, scale, solve; aspect names                                                                                                                |
| [pixels](pixels/)     |   ✅   | 21 — in/cm/mm/pt/pc ↔ px at a ppi                                                                                                                        |
| [math](math/)         |   ✅   | 1, 4 (units, US kitchen units, `Mbps`), 5 (percent questions, % change), 9 (automatic conversion), 11 (`log` base 10, `ln`), 20 (dimensioned arithmetic) |
| [currency](currency/) |   ✅   | 3 (fiat, `USD1K` shorthand), 19 (crypto via the `crypto-price` feed), 20 (rates per unit)                                                                |
| [datetime](datetime/) |   ✅   | 10 (countdowns, holidays, quarters, calendar spans, age), 12 (nth weekday, period ends), 17, 23 (ISO 8601, epoch), 24 (workdays)                         |
| [timezone](timezone/) |   ✅   | 7, 8 (with a date), 18 (time difference)                                                                                                                 |

Shared helpers used by several evaluators live in [`../common/`](../common/):
`locale.ts` (the number format), `precision.ts` (display rounding),
`timespan.ts` (duration parsing/formatting).

UI / storage features:

- **2 — clipboard**: `↵` copy, `⌥↵` copy unformatted, `⇧⌘↵` copy question &
  answer, `⌘↵` use as input (launcher calculator row).
- **6 — Calculator History** and **15 — pinned calculations**: the
  [`calculator-history` extension](../../../extensions/calculator-history/).
- **13 — number formatting**: Settings → Calculator → Number format
  (System / `1,234.5` / `1.234,5`); input is read and output written in it.
  Dates keep the house `Mon, Aug 10` format.

Not supported: historical currency rates (the free feed has no history and
`evaluate()` stays synchronous); picking among same-named places (`places.ts`
has no population data).

## Why "mostly already worked" shows up a lot

Several of the docs in `pere-doc/` were written against an older single-file
`calculator.ts` and describe gaps that the `mathjs` version now in use (v15)
already closes natively — confirmed by testing directly against the installed
library, not just reading the docs. Notably: unit-aware math (`10 ft in m`,
`128 GB to MB`) and percent-of-the-other-operand semantics (`100 + 10%` →
`110`) both work out of the box. Each evaluator's own README says exactly
what was already free vs. what it actually had to add — read those before
assuming a `pere-doc` gap is still open.

## Shared shape

- `Calculation { expression, value, rawValue, tokens?, footnote?, items?, details? }` in
  [src/shared/types.ts](../../../shared/types.ts); attached to
  `QueryResult.calculation` by `query()` in
  [src/main/actions.ts](../../actions.ts); rendered by
  [CalculatorPanel.tsx](../../../renderer/src/screens/launcher/components/CalculatorPanel.tsx).
  `items` (label/value chips that replace the value) is timezone's
  multi-zone country listing; `details` (chips under the value) carries a
  result's extras — "You save", "Total", a ratio's decimal, other unit
  conversions, an ISO timestamp's UTC/epoch.
- `evaluate()` stays **synchronous**, even where the underlying data or logic
  isn't trivial:
  - `currency` reads an in-memory rate table kept fresh by a background
    `CachedActionSource` ([exchange-rate](../../sources/calculator/exchange-rate/)).
  - `datetime`/`timezone` take an injected clock (`now: () => Date`, plus
    `timezone` also injects the "local zone") instead of calling `Date.now()`
    directly, purely so tests are deterministic — production still just calls
    `new Date()` per evaluation.
- Every evaluator is cheap to reject: the pipeline runs on every keystroke, so
  each has its own fast pre-filter (a regex keyword gate, a "does this even
  have a digit" check) before doing any real parsing work.
- A `Calculation` is never returned by more than one evaluator's own testing —
  when a later evaluator's grammar could plausibly overlap an earlier one's
  input shape (e.g. `datetime`'s bare `A to B` vs. `math`'s unit conversion
  `10 ft to m`), the guard is _both_ running order (earlier evaluators already
  claimed what they understood) _and_ the later evaluator independently
  verifying its own parse succeeded on both sides — never one relying on the
  other to have already rejected the string.

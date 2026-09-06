# Calculator evaluators

The calculator pipeline ([../index.ts](../index.ts)) tries each `Evaluator`
below in order and takes the first non-null `Calculation`. Detection is not a
separate classifier — each evaluator's own parser decides whether the input is
"its kind" and returns `null` otherwise, so order only matters for the
ambiguous cases (a fail-fast evaluator earlier in the list is harmless; see
each evaluator's own README for why its position is safe).

```
const evaluators = [math, currency, datetime, timezone]
```

Backed by research in [pere-doc/calculation/](../../../../pere-doc/calculation/)
(gitignored) — 24 Raycast calculator features mapped onto these ~5 engines.

| Evaluator | Status | Feature #s (see pere-doc) |
|---|:--:|---|
| [math](math/) | ✅ | 1, 4 (partial), 5, 11, 14, 20, 22 |
| [currency](currency/) | ✅ | 3 (crypto 19 = a second feed, not built) |
| [datetime](datetime/) | ✅ | 10, 12, 16 (partial), 17, 24 |
| [timezone](timezone/) | ✅ | 7, 8, 18 (not built — a second "time diff between two places" shortcut) |
| units | — | folded into `math` rather than a standalone evaluator — `mathjs`'s own unit engine already covers most of #4/#9/#21, so this stayed a normalization step (`math/units.ts`) instead of a new pipeline stage |

Features 2 (clipboard), 6 (history), 13 (number formatting), 15 (pinned) are
UI / storage, not evaluators, and remain backlog.

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

- `Calculation { expression, value, rawValue, tokens?, footnote?, items? }` in
  [src/shared/types.ts](../../../shared/types.ts); attached to
  `QueryResult.calculation` by `query()` in
  [src/main/actions.ts](../../actions.ts); rendered by
  [CalculatorPanel.tsx](../../../renderer/src/screens/launcher/components/CalculatorPanel.tsx).
  `items` (label/value pairs, rendered as wrapped chips instead of one line)
  exists only for `timezone`'s multi-zone country listing so far — every
  other evaluator leaves it unset.
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
  `10 ft to m`), the guard is *both* running order (earlier evaluators already
  claimed what they understood) *and* the later evaluator independently
  verifying its own parse succeeded on both sides — never one relying on the
  other to have already rejected the string.

import type { Calculation } from '../../../../shared/types'
import type { Evaluator } from '../../types.ts'
import { looksLikeDate } from './gate.ts'
import { resolveArithmetic } from './arithmetic.ts'
import { resolveCountdown } from './countdown.ts'
import { resolveDifference } from './difference.ts'
import { resolveRelative } from './relative.ts'

/**
 * The datetime evaluator — relative dates, countdowns, and date differences,
 * via `chrono-node`.
 *
 *   - relative dates — "tomorrow", "35 days ago", "monday in 3 weeks",
 *     "in 10 business days", "first day of next month"
 *   - countdowns — "days until 25 Dec", "weeks left in the quarter"
 *   - differences — "days between 1 Jan and 1 Apr", "1990-05-01 to today"
 *   - arithmetic — "August 5 + 5", "3:45pm + 90 min", "2026-01-15 + 3 weeks"
 *
 * `looksLikeDate` is a cheap keyword gate (the evaluator runs on every
 * keystroke) — only plausible candidates reach `chrono`. Beyond that, each
 * resolver is its own format check: `countdown`/`difference` require an
 * explicit `until`/`between…and` shape, and `relative`'s `chrono.parse`
 * fallback requires the match to span the *entire* input (see its comment),
 * so this never claims an ordinary search query that merely contains a
 * date-ish word ("today's news", "monday.com").
 */
function run(now: () => Date, input: string): Calculation | null {
  if (!looksLikeDate(input)) return null
  const at = now()

  return (
    resolveCountdown(input, at) ??
    resolveDifference(input, at) ??
    resolveArithmetic(input, at) ??
    resolveRelative(input, at)
  )
}

export const datetime: Evaluator = {
  id: 'datetime',
  evaluate: (input) => run(() => new Date(), input),
}

/** Same evaluator bound to an explicit clock — for deterministic tests. */
export function createDatetimeEvaluator(now: () => Date): Evaluator {
  return { id: 'datetime', evaluate: (input) => run(now, input) }
}

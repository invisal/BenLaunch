import type { Calculation } from '../../../../shared/types'
import type { Evaluator } from '../../types.ts'
import { resolveConvert } from './convert.ts'
import { resolveClock, systemZone } from './clock.ts'

/**
 * Cheap pre-filter: every query this evaluator understands either contains
 * the word "time" (`clock.ts`'s two shapes) or opens with a time-of-day token
 * (`convert.ts`'s `<time> ... in|to <place>`). Anything else is certainly not
 * a timezone query, so `resolvePlace`'s fuzzy scan never runs for it.
 */
const LOOKS_LIKE_TIME_QUERY = /\btime\b|^(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon|midnight)\s/i

/**
 * The timezone evaluator — current time in a place, and converting a
 * specific time between places. Last in the pipeline
 * ([../../index.ts](../../index.ts)); by the time it runs, `math`/`currency`/
 * `datetime` have already claimed anything they understood.
 *
 *   - current time — "time in Tokyo", "time at sf", "Tokyo time"
 *   - convert a time — "5pm ldn in sf", "9:30am NYC to Berlin", "noon Tokyo in London"
 *
 * `resolveConvert` is tried first (more specific: needs a leading time token
 * *and* an `in|to <place>`), then `resolveClock`.
 */
function run(now: () => Date, localZone: () => string, input: string): Calculation | null {
  if (!LOOKS_LIKE_TIME_QUERY.test(input)) return null
  const at = now()
  const zone = localZone()

  return resolveConvert(input, at, zone) ?? resolveClock(input, at, zone)
}

export const timezone: Evaluator = {
  id: 'timezone',
  evaluate: (input) => run(() => new Date(), systemZone, input),
}

/** Same evaluator bound to an explicit clock/zone — for deterministic tests. */
export function createTimezoneEvaluator(now: () => Date, localZone: () => string): Evaluator {
  return { id: 'timezone', evaluate: (input) => run(now, localZone, input) }
}

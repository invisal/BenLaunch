import * as chrono from 'chrono-node'
import type { Calculation } from '../../../../shared/types'
import { formatDuration, normalizeDurationUnit } from './format.ts'
import { lastDayOfPeriod, type Period } from './period.ts'

/** `days|weeks|months|hours until|till|to <target>` — "days until 25 Dec". */
const COUNTDOWN_TO = /^(days?|weeks?|months?|hours?)\s+(?:until|till|to)\s+(.+)$/i

/** `days|weeks|months left in (the) quarter|year|month|week`. */
const LEFT_IN_PERIOD =
  /^(days?|weeks?|months?)\s+left\s+in\s+(?:the\s+)?(quarter|year|month|week)$/i

/**
 * Countdowns: `days until 25 Dec` → a duration, not a date. Claims only the
 * `until/till/to <target>` and `left in the <period>` shapes — anything else
 * falls through to `difference` / `relative`.
 */
export function resolveCountdown(input: string, now: Date): Calculation | null {
  const toMatch = input.match(COUNTDOWN_TO)
  if (toMatch) {
    const [, unitWord, targetText] = toMatch
    const target = chrono.parseDate(targetText, now, { forwardDate: true })
    if (!target) return null

    const ms = target.getTime() - now.getTime()
    if (ms <= 0) return null

    const { value, rawValue } = formatDuration(ms, normalizeDurationUnit(unitWord))
    return { expression: input, value, rawValue }
  }

  const leftMatch = input.match(LEFT_IN_PERIOD)
  if (leftMatch) {
    const [, unitWord, period] = leftMatch
    const ms = lastDayOfPeriod(period as Period, now).getTime() - now.getTime()
    if (ms <= 0) return null

    const { value, rawValue } = formatDuration(ms, normalizeDurationUnit(unitWord))
    return { expression: input, value, rawValue }
  }

  return null
}

import * as chrono from 'chrono-node'
import type { Calculation } from '../../../../shared/types'
import { formatDuration, normalizeDurationUnit } from './format.ts'

/** `(days|weeks|...)? between A and B` — "days between 1 Jan and 15 Mar". */
const BETWEEN = /^(?:(days?|weeks?|months?|years?)\s+)?between\s+(.+?)\s+and\s+(.+)$/i

/** A trailing `in <unit>` the user appends to force the result's unit —
 *  "1988-12-08 to today in days". Stripped before the shape match, then fed in
 *  as the explicit unit. */
const TRAILING_UNIT = /\s+in\s+(days?|weeks?|months?|hours?)\s*$/i

/** Bare `A to|until B` — "1990-05-01 to today". Only claimed when *both*
 *  sides independently parse as dates (see `parseBothSides` below), which is
 *  what keeps this from colliding with `math`'s `10 ft to m` or `currency`'s
 *  `10 usd to eur` — those are already claimed earlier in the pipeline
 *  anyway, but this guard also protects against ordinary phrases like
 *  "flight to paris" (neither side parses as a date, so it's a no-op). */
const BARE_TO = /^(.+?)\s+(?:to|until)\s+(.+)$/i

/**
 * A month-day reference with no year (`1 Jan`, `15 Mar`) resolves to
 * *whichever* year `chrono` thinks is nearest to `now` — independently for
 * each side, which can put two dates that are meant to sit in the same
 * "season" a year apart (`1 Jan` → next year, `1 Apr` → this year). If the
 * naive parse comes out backwards, re-resolve the right side relative to the
 * left side (and forward in time) instead of `now` — this is what makes
 * `between 1 Jan and 1 Apr` land 90 days apart instead of 455, and
 * `now until 9AM` (late at night) point at *tomorrow* 9AM rather than this
 * morning's.
 */
function parseBothSides(leftText: string, rightText: string, now: Date): [Date, Date] | null {
  const left = chrono.parseDate(leftText, now, {})
  if (!left) return null

  let right = chrono.parseDate(rightText, now, {})
  if (!right) return null

  if (right.getTime() < left.getTime()) {
    const rechained = chrono.parseDate(rightText, left, { forwardDate: true })
    if (rechained && rechained.getTime() >= left.getTime()) right = rechained
  }

  return [left, right]
}

function build(input: string, unit: string | undefined, left: Date, right: Date): Calculation {
  const ms = Math.abs(right.getTime() - left.getTime())
  const { value, rawValue } = formatDuration(
    ms,
    unit ? normalizeDurationUnit(unit) : undefined,
  )
  return { expression: input, value, rawValue }
}

export function resolveDifference(input: string, now: Date): Calculation | null {
  const tail = input.match(TRAILING_UNIT)
  const trailingUnit = tail?.[1]
  const shape = tail ? input.slice(0, tail.index) : input

  const between = shape.match(BETWEEN)
  if (between) {
    const [, unit, leftText, rightText] = between
    const parsed = parseBothSides(leftText, rightText, now)
    if (!parsed) return null
    return build(input, unit ?? trailingUnit, ...parsed)
  }

  const bare = shape.match(BARE_TO)
  if (bare) {
    const [, leftText, rightText] = bare
    const parsed = parseBothSides(leftText, rightText, now)
    if (!parsed) return null
    return build(input, trailingUnit, ...parsed)
  }

  return null
}

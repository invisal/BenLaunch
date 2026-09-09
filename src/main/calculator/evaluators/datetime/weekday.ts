import * as chrono from 'chrono-node'
import type { Calculation } from '../../../../shared/types'

/**
 * "What day of the week does a date fall on?" — `day of 2026-12-25`,
 * `what day is 25 Dec 2026`, `what day of the week is 2026-12-25`,
 * `weekday of 2026-12-25`, `2026-12-25 what day`.
 *
 * Answers with the spelled-out weekday plus the resolved date for confirmation
 * (`Friday, Dec 25, 2026`); `rawValue` is the bare weekday.
 */
const PHRASINGS: readonly RegExp[] = [
  // "what day (of the week) is/was X"
  /^what\s+day(?:\s+of\s+(?:the\s+)?week)?\s+(?:is|was|will\s+it\s+be)\s+(.+?)\s*\??$/i,
  // "day of / weekday of / day of the week (for) X"
  /^(?:the\s+)?(?:weekday|day)\s+of\s+(?:the\s+week\s+)?(?:for\s+|is\s+)?(.+?)\s*\??$/i,
  // "X — what day (of the week)" / "X day of week"
  /^(.+?)\s+(?:is\s+)?(?:what\s+day(?:\s+of\s+(?:the\s+)?week)?|day\s+of\s+(?:the\s+)?week|weekday)\s*\??$/i,
]

export function resolveWeekday(input: string, now: Date): Calculation | null {
  for (const re of PHRASINGS) {
    const m = input.match(re)
    if (!m) continue

    const dateText = m[1].trim()
    const results = chrono.parse(dateText, now, {})
    if (results.length !== 1) return null

    const [result] = results
    if (result.index !== 0 || result.text.length !== dateText.length) return null

    const date = result.start.date()
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date)
    const sameYear = date.getFullYear() === now.getFullYear()
    const label = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    }).format(date)

    return { expression: input, value: `${weekday}, ${label}`, rawValue: weekday }
  }
  return null
}

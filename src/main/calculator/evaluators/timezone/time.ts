export interface TimeOfDay {
  hour: number
  minute: number
}

const CLOCK = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i

/**
 * A minimal time-of-day parser: `5pm`, `9:30am`, `17:00`, `noon`, `midnight`.
 * Returns `null` for anything else — no new dependency, the grammar is small
 * enough to hand-roll.
 */
export function parseTimeOfDay(text: string): TimeOfDay | null {
  const trimmed = text.trim().toLowerCase()
  if (trimmed === 'noon') return { hour: 12, minute: 0 }
  if (trimmed === 'midnight') return { hour: 0, minute: 0 }

  const match = trimmed.match(CLOCK)
  if (!match) return null

  const [, hourText, minuteText, meridiem] = match
  let hour = Number(hourText)
  const minute = minuteText ? Number(minuteText) : 0
  if (minute > 59) return null

  if (meridiem) {
    if (hour < 1 || hour > 12) return null
    if (meridiem === 'am') hour = hour === 12 ? 0 : hour
    else hour = hour === 12 ? 12 : hour + 12
  } else if (hour > 23) {
    return null
  }

  return { hour, minute }
}

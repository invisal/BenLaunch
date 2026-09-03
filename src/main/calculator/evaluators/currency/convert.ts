/**
 * Converts `amount` from one currency to another using a `base`-relative rate
 * table (`rate[X]` = units of X per 1 unit of base). Both currencies must be in
 * the table — `null` otherwise.
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number | null {
  const rFrom = from === 'USD' && !rates.USD ? 1 : rates[from]
  const rTo = to === 'USD' && !rates.USD ? 1 : rates[to]
  if (!rFrom || !rTo || !Number.isFinite(rFrom) || !Number.isFinite(rTo)) return null
  return (amount * rTo) / rFrom
}

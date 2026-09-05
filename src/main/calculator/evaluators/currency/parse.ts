import { resolveCurrency, SYMBOL_CHARS } from './currencies.ts'

export interface CurrencyQuery {
  amount: number
  from: string
  to: string
}

/**
 * A number with an optional magnitude suffix — `1,000`, `2.5k`, `1m`, `.5b`.
 * The suffix must end a word (`\b`), so the `k` in "5000 khr" is *not* a suffix.
 */
const AMOUNT = /-?[\d,]*\.?\d+(?:\s*[kmb]\b)?/i

function parseAmount(text: string): number | null {
  const match = text.match(/(-?[\d,]*\.?\d+)\s*([kmb])?/i)
  if (!match) return null
  const n = Number(match[1].replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  const scale = { k: 1e3, m: 1e6, b: 1e9 }[match[2]?.toLowerCase() ?? ''] ?? 1
  return n * scale
}

const SYMBOL_PREFIX = new RegExp(`^\\s*(${SYMBOL_CHARS.map((s) => `\\${s}`).join('|')})\\s*`)

/**
 * Parses a currency conversion out of a normalized query:
 *
 *   "10 usd in gbp"   → { amount: 10, from: 'USD', to: 'GBP' }
 *   "$50 to eur"      → { amount: 50, from: 'USD', to: 'EUR' }
 *   "1.2k dollars in yen" → { amount: 1200, from: 'USD', to: 'JPY' }
 *   "usd in eur"      → { amount: 1,  from: 'USD', to: 'EUR' }   (rate for 1)
 *
 * Returns `null` unless *both* sides resolve to a currency in `known` — so
 * "128 GB to MB" and "5 m to ft" fall through to the next evaluator.
 */
export function parse(input: string, known: ReadonlySet<string>): CurrencyQuery | null {
  const split = input.match(/^(.+?)\s+(?:in|to)\s+(\S.*)$/i)
  if (!split) return null

  const [, left, rightRaw] = split

  const to = resolveCurrency(rightRaw.replace(/[.?!]+$/, ''), known)
  if (!to) return null

  // Left side: optional leading symbol, a number, and/or a trailing currency token.
  let rest = left
  const symbolMatch = rest.match(SYMBOL_PREFIX)
  const leadingSymbol = symbolMatch?.[1]
  if (symbolMatch) rest = rest.slice(symbolMatch[0].length)

  const amountText = rest.match(AMOUNT)?.[0] ?? ''
  const amount = amountText ? parseAmount(amountText) : 1
  if (amount === null) return null

  const currencyToken = rest.replace(amountText, '').trim()
  const from =
    (currencyToken && resolveCurrency(currencyToken, known)) ||
    (leadingSymbol ? resolveCurrency(leadingSymbol, known) : null)
  if (!from) return null

  return { amount, from, to }
}

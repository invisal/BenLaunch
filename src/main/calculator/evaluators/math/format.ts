import { mathjs, type EvalResult } from './evaluate.ts'

export interface FormattedResult {
  /** For display: thousands grouped, unit suffix kept. */
  value: string
  /** For pasting into code / feeding back into the search: no grouping. */
  rawValue: string
}

/** Trim floating-point noise (0.1 + 0.2 → 0.3) without forcing a fixed precision. */
function tidy(value: number): number {
  return Number(value.toPrecision(12))
}

export function formatResult(result: EvalResult): FormattedResult {
  if (result.kind === 'number') {
    const n = tidy(result.value)
    return {
      value: n.toLocaleString('en-US', { maximumFractionDigits: 12 }),
      rawValue: String(n),
    }
  }

  // Units: fixed notation, no runaway exponents, e.g. "1.9685039 inch", "128000 MB".
  const formatted = mathjs.format(result.value, {
    notation: 'auto',
    precision: 8,
    lowerExp: -9,
    upperExp: 15,
  })
  return { value: formatted, rawValue: formatted }
}

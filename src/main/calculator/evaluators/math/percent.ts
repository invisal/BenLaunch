/**
 * Percentage phrasing `mathjs` doesn't already understand.
 *
 * `mathjs` (v15+) already gives a trailing `%` the "of the other operand"
 * semantics people expect: `100 + 10%` → `110`, `19m + 47%` → `27.93 m`, bare
 * `47%` → `0.47`. See `evaluate.test.ts` / `README.md` for the confirmed
 * cases — none of that needs rewriting here.
 *
 * The one gap is `of`, which isn't a `mathjs` operator: `X% of Y` has to
 * become `X% * Y` before the parser sees it.
 */

/** `32% of 5` → `32% * 5`. Only touches `of` right after a `%`, so it never
 *  reaches for an unrelated "of" elsewhere in the string. */
const PERCENT_OF = /%\s*of\s+/gi

/** `what percent(age) is A of B` / `what percentage of B is A`. */
const PERCENT_OF_QUESTION =
  /^what\s+percent(?:age)?\s+is\s+([\d.]+)\s+of\s+([\d.]+)$/i
const PERCENT_OF_QUESTION_ALT =
  /^what\s+percent(?:age)?\s+of\s+([\d.]+)\s+is\s+([\d.]+)$/i

export interface PercentQuestion {
  /** The ratio as a percentage, e.g. `16` for "what percent is 32 of 200". */
  percent: number
}

/**
 * `X% of Y` → `X% * Y`, letting `mathjs`'s native percent semantics do the
 * rest. Safe to run unconditionally before the gate — it's a no-op unless a
 * `%` is directly followed by `of`.
 */
export function rewritePercentOf(expression: string): string {
  return expression.replace(PERCENT_OF, '% * ')
}

/**
 * "what percent is A of B" / "what percentage of B is A" — answered directly
 * as a ratio, not routed through `mathjs` (the result is a `%`-suffixed
 * fraction, not a plain number or unit).
 */
export function parsePercentQuestion(expression: string): PercentQuestion | null {
  const direct = expression.match(PERCENT_OF_QUESTION)
  if (direct) {
    const [, a, b] = direct
    return ratioOf(Number(a), Number(b))
  }

  const inverted = expression.match(PERCENT_OF_QUESTION_ALT)
  if (inverted) {
    const [, b, a] = inverted
    return ratioOf(Number(a), Number(b))
  }

  return null
}

function ratioOf(a: number, b: number): PercentQuestion | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null
  return { percent: (a / b) * 100 }
}

/** `16.666...` → `16.67` — trims to a friendly percent, no trailing zeros. */
export function formatPercent(percent: number): string {
  return Number(percent.toFixed(2)).toString()
}

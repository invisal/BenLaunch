import { create, all } from 'mathjs'
import type { Calculation } from '../shared/types'

/**
 * Detect and evaluate a math expression typed into the launcher, via mathjs —
 * so `sin(30 deg)`, `2^10`, `5 km to miles`, `128 GB in MB` all work.
 *
 * mathjs's expression parser cannot execute arbitrary JS (no property access, no
 * `Function`), and since v11 the meta-functions that could widen the surface
 * (`import`, `createUnit`, …) are not reachable from an expression. We disable
 * them on the instance as well, for defence in depth.
 */
const math = create(all, { number: 'number' })

// Capture the real evaluator before neutering the meta-functions, so we keep a
// working reference while making `import(...)` etc. throw if ever reached.
const evaluateExpr = math.evaluate.bind(math)
math.import(
  Object.fromEntries(
    ['import', 'createUnit', 'simplify', 'derivative', 'resolve'].map((name) => [
      name,
      () => {
        throw new Error(`${name} is disabled`)
      },
    ]),
  ),
  { override: true },
)

/** A word followed by `(` — a function call like `sin(`, `sqrt(`. */
const FUNCTION_CALL = /[a-z_]\w*\s*\(/i
/** Any binary/postfix operator (a leading unary +/- is stripped before testing). */
const OPERATOR = /[+\-*/%^!]/

/**
 * Returns a `Calculation` when `query` looks and parses as math, otherwise
 * `null` so the string falls through to the normal action search.
 *
 * The "looks like math" gate matters: mathjs resolves bare words to constants
 * and units (`pi`, `e`, `in`, `cm`), so without it a search for "inkscape" or
 * "code" could masquerade as a calculation. We require a digit or a function
 * call to even try, and reject a result that is just the number the user typed.
 */
export function evaluate(query: string): Calculation | null {
  const expression = query.trim()
  if (!expression) return null

  const hasDigit = /\d/.test(expression)
  const hasCall = FUNCTION_CALL.test(expression)
  if (!hasDigit && !hasCall) return null

  let result: unknown
  try {
    result = evaluateExpr(expression)
  } catch {
    return null
  }

  if (typeof result === 'number') {
    if (!Number.isFinite(result)) return null
    // A bare literal ("42", "1,000", "2 pi") is not a calculation worth showing.
    const hasOperator = OPERATOR.test(expression.replace(/^\s*[-+]/, ''))
    if (!hasOperator && !hasCall) return null
    return { expression, value: formatNumber(result) }
  }

  if (math.isUnit(result)) {
    return { expression, value: formatUnit(result) }
  }

  // Booleans, functions, complex numbers, matrices — not an inline answer.
  return null
}

/** Trim floating-point noise (0.1 + 0.2 → "0.3") and group thousands. */
function formatNumber(value: number): string {
  const rounded = Number(value.toPrecision(12))
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 12 })
}

/** e.g. `1.9685039 inch`, `128000 MB` — fixed notation, no runaway exponents. */
function formatUnit(value: unknown): string {
  return math.format(value, { notation: 'auto', precision: 8, lowerExp: -9, upperExp: 15 })
}

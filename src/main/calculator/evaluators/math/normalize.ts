/**
 * Math-specific rewriting: turn loosely-typed arithmetic into strict `mathjs`
 * syntax. Runs *after* the shared `calculator/normalize.ts` (which has already
 * stripped framing like "what is …" and a trailing "="), so this only deals
 * with operators.
 *
 * Every rule is conservative — a spoken operator must sit *between* two operands
 * — so "sunny plus warm" survives unchanged and is rejected by the gate.
 */

/** Unicode math symbols from copy-paste or the keyboard. */
const SYMBOLS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[×✕✖⨯]/g, ' * '],
  [/[÷]/g, ' / '],
  [/[−–—]/g, '-'], // U+2212 minus sign, en dash, em dash
  [/π/g, ' pi '],
]

/** Spoken operators — rewritten only with whitespace on both sides. */
const WORD_OPERATORS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\s+plus\s+/gi, ' + '],
  [/\s+minus\s+/gi, ' - '],
  [/\s+(?:times|multiplied\s+by)\s+/gi, ' * '],
  [/\s+divided\s+by\s+/gi, ' / '],
  [/\s+(?:mod|modulo)\s+/gi, ' % '],
  [/\s+(?:to\s+the\s+power\s+of|power|pow)\s+/gi, ' ^ '],
]

/** `3 x 4` / `3x4` — "x" as multiply, but only wedged between two numbers. */
const X_MULTIPLY = /(\d)\s*x\s*(?=[(\d])/gi

export function normalizeMath(input: string): string {
  let out = input

  for (const [pattern, replacement] of SYMBOLS) out = out.replace(pattern, replacement)
  for (const [pattern, replacement] of WORD_OPERATORS) out = out.replace(pattern, replacement)
  out = out.replace(X_MULTIPLY, '$1 * ')

  // Collapse whitespace the rewrites introduced, but keep single spaces so
  // "2 pi" (implicit multiplication) is not silently turned into "2pi".
  return out.replace(/\s+/g, ' ').trim()
}

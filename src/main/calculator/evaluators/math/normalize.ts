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
  [/√/g, ' sqrt '], // "√625", "√(2)"
]

/**
 * Spoken function forms `mathjs` can't parse on its own — "square root of 625",
 * "cube root of 27", "factorial of 5". Rewritten to a bare `fn operand`, which
 * `wrapBareCalls` then parenthesises into `fn(operand)`.
 */
const FUNCTION_WORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:the\s+)?(?:square\s+root\s+of|sqrt\s+of)\s+/gi, 'sqrt '],
  [/\b(?:the\s+)?cube\s+root\s+of\s+/gi, 'cbrt '],
  [/\b(?:the\s+)?factorial\s+of\s+/gi, 'factorial '],
]

/**
 * `sqrt 625` → `sqrt(625)`. `mathjs` needs the parens; natural phrasing and the
 * `√` / "root of" rewrites above leave them off. The operand is a single token:
 * a number (thousands separators allowed), a constant, a parenthesised group,
 * or a nested function call.
 */
const BARE_CALL =
  /\b(sqrt|cbrt|factorial)\s+(\d[\d,]*(?:\.\d+)?|[a-z]\w*\s*\([^()]*\)|\([^()]*\)|pi|tau|phi|e)/gi

function wrapBareCalls(input: string): string {
  return input.replace(BARE_CALL, (_match, fn: string, operand: string) => {
    const arg = operand.replace(/,/g, '')
    // Operand already a parenthesised group ("sqrt (16 + 9)") — don't double-wrap.
    return /^\(.*\)$/.test(arg) ? `${fn}${arg}` : `${fn}(${arg})`
  })
}

/**
 * Postfix "X squared" / "X cubed" (the trailing "d" is optional) → `(X)^2` /
 * `(X)^3`. The base is the single token immediately before the word: a number,
 * a constant, or a parenthesised group ("(2 + 3) squared"). A following word
 * (`5 square feet`) means it's a unit phrase, not a power — left alone.
 */
const POWER_WORDS =
  /(\([^()]*\)|\d[\d,]*(?:\.\d+)?|pi|tau|phi|e)\s+(squared?|cubed?)\b(?!\s+[a-z])/gi

function rewritePowerWords(input: string): string {
  return input.replace(POWER_WORDS, (_match, base: string, word: string) => {
    const exponent = word.toLowerCase().startsWith('square') ? '2' : '3'
    const arg = base.replace(/,/g, '')
    return /^\(.*\)$/.test(arg) ? `${arg}^${exponent}` : `(${arg})^${exponent}`
  })
}

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
  for (const [pattern, replacement] of FUNCTION_WORDS) out = out.replace(pattern, replacement)
  out = wrapBareCalls(out)
  out = rewritePowerWords(out)
  out = out.replace(X_MULTIPLY, '$1 * ')

  // Collapse whitespace the rewrites introduced, but keep single spaces so
  // "2 pi" (implicit multiplication) is not silently turned into "2pi".
  return out.replace(/\s+/g, ' ').trim()
}

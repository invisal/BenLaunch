/**
 * The "is this actually math?" gate.
 *
 * `mathjs` resolves bare words to constants and units (`pi`, `e`, `in`, `cm`),
 * so without these checks a search for "inkscape" or "code" could masquerade as
 * a calculation. Two gates:
 *
 *  - `looksLikeMath` — a cheap pre-filter: only expressions with a digit or a
 *    function call are even handed to the parser.
 *  - `isCalculation` — a post-filter for numeric results: a bare literal
 *    ("42", "1,000", "2 pi") is a number but not a *calculation* worth showing.
 */

/** A word immediately followed by `(` — `sin(`, `sqrt(`. */
const FUNCTION_CALL = /[a-z_]\w*\s*\(/i

/** Any binary/postfix operator (a leading unary +/- is stripped before testing). */
const OPERATOR = /[+\-*/%^!]/

export function looksLikeMath(expression: string): boolean {
  return /\d/.test(expression) || FUNCTION_CALL.test(expression)
}

export function isCalculation(expression: string): boolean {
  const withoutLeadingSign = expression.replace(/^\s*[-+]/, '')
  return OPERATOR.test(withoutLeadingSign) || FUNCTION_CALL.test(expression)
}

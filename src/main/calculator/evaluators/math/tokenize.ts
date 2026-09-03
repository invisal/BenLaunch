import type { CalcToken } from '../../../../shared/types'

/**
 * Splits a *normalized* expression into typed runs for syntax highlighting in
 * the renderer.
 *
 * This is best-effort: if the string contains anything the lexer doesn't
 * recognise it returns `[]`, and the UI falls back to showing the plain
 * expression (or its "Calculator" label). It never throws.
 */

/** Bare words that read as operators rather than units — "5 m to ft", "3 in 2". */
const WORD_OPERATORS = new Set(['to', 'in', 'mod'])

/** Constants mathjs exposes that we colour distinctly from units. */
const CONSTANTS = new Set(['pi', 'e', 'tau', 'phi', 'i', 'inf', 'infinity', 'nan'])

const LEXER = new RegExp(
  [
    '(?<number>\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?)',
    '(?<operator>[+\\-*/%^!])',
    '(?<paren>[()])',
    '(?<punct>,)',
    '(?<ident>[A-Za-z_][A-Za-z_0-9]*)',
    '(?<whitespace>\\s+)',
  ].join('|'),
  'giy', // sticky: each match must start exactly where the last ended
)

export function tokenize(expression: string): CalcToken[] {
  if (!expression) return []

  const tokens: CalcToken[] = []
  LEXER.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = LEXER.exec(expression)) !== null) {
    const groups = match.groups as Record<string, string | undefined>
    const [text] = match

    if (groups.number !== undefined) {
      tokens.push({ text, kind: 'number' })
    } else if (groups.operator !== undefined) {
      tokens.push({ text, kind: 'operator' })
    } else if (groups.paren !== undefined) {
      tokens.push({ text, kind: 'paren' })
    } else if (groups.punct !== undefined) {
      tokens.push({ text, kind: 'punct' })
    } else if (groups.whitespace !== undefined) {
      tokens.push({ text, kind: 'whitespace' })
    } else if (groups.ident !== undefined) {
      const lower = text.toLowerCase()
      const rest = expression.slice(LEXER.lastIndex).trimStart()
      if (rest.startsWith('(')) tokens.push({ text, kind: 'function' })
      else if (WORD_OPERATORS.has(lower)) tokens.push({ text, kind: 'operator' })
      else if (CONSTANTS.has(lower)) tokens.push({ text, kind: 'constant' })
      else tokens.push({ text, kind: 'unit' })
    }
  }

  // A gap means the lexer hit a character it doesn't model — give up cleanly.
  const consumed = tokens.reduce((sum, token) => sum + token.text.length, 0)
  return consumed === expression.length ? tokens : []
}

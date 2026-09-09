import type { Calculation } from '../../../../shared/types'
import type { Evaluator } from '../../types.ts'
import { normalizeMath } from './normalize.ts'
import { isCalculation, looksLikeMath } from './gate.ts'
import { tryEvaluate } from './evaluate.ts'
import { formatResult } from './format.ts'
import { tokenize } from './tokenize.ts'
import { formatPercent, parsePercentQuestion, rewritePercentOf } from './percent.ts'
import { rewriteUnits } from './units.ts'

/**
 * The math evaluator — arithmetic and everything `mathjs` already understands.
 *
 *   - spoken operators — "5 plus 3", "100 divided by 4", "2 to the power of 8"
 *   - symbol variants — "12 × 3", "100 ÷ 4", "8 − 5"
 *   - precedence, parens, factorial, `sqrt(…)`, `sin(30 deg)`
 *   - unit math — "10 cm in mm", "128 GB to MB"
 *
 * Input arrives already framed by `calculator/normalize.ts` (no "what is …",
 * no trailing "="). Non-math queries fail the gate and return `null`, so they
 * fall through to the next evaluator / the action search.
 */
export const math: Evaluator = {
  id: 'math',

  evaluate(input: string): Calculation | null {
    let expression = normalizeMath(input)
    if (!expression) return null

    // `2026-01-15 + 3` is date arithmetic (→ `datetime`), not the literal
    // `2026 - 1 - 15 + 3`. An ISO date followed by `+`/`-` — or standing alone
    // (`2026-12-25`, "what day is it?") — is never a sum.
    if (/\d{4}-\d{2}-\d{2}\s*[-+]/.test(expression)) return null
    if (/^\s*\d{4}-\d{2}-\d{2}\s*$/.test(expression)) return null

    // A leading `in`/`at` + number is a relative-time phrase for `datetime`
    // ("in 3 hours", "in 10 days") — `mathjs` would read `in` as the inch unit
    // and yield a nonsense `3 in hours`.
    if (/^\s*(?:in|at)\s+\d/i.test(expression)) return null

    const question = parsePercentQuestion(expression)
    if (question) {
      const value = `${formatPercent(question.percent)}%`
      return { expression, value, rawValue: value }
    }

    expression = rewriteUnits(rewritePercentOf(expression))
    if (!looksLikeMath(expression)) return null

    const result = tryEvaluate(expression)
    if (!result) return null

    // A bare literal ("42", "1,000", "2 pi") parses to a number but is not a
    // calculation worth surfacing above the action list.
    if (result.kind === 'number' && !isCalculation(expression)) return null

    const { value, rawValue } = formatResult(result)
    const tokens = tokenize(expression)

    return {
      expression,
      value,
      rawValue,
      ...(tokens.length > 0 ? { tokens } : {}),
    }
  },
}

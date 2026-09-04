import type { Calculation } from '../../../../shared/types'
import type { Evaluator } from '../../types.ts'
import { normalizeMath } from './normalize.ts'
import { isCalculation, looksLikeMath } from './gate.ts'
import { tryEvaluate } from './evaluate.ts'
import { formatResult } from './format.ts'
import { tokenize } from './tokenize.ts'

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
    const expression = normalizeMath(input)
    if (!expression || !looksLikeMath(expression)) return null

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

import type { Calculation } from '../../shared/types'
import type { Evaluator } from './types.ts'
import { normalize } from './normalize.ts'
import { math } from './evaluators/math/index.ts'

/**
 * The calculator pipeline.
 *
 *   query ─▶ normalize (shared framing) ─▶ try evaluators in order ─▶ Calculation
 *
 * It's all one feature — "type something, get an answer" — but the compute
 * engines differ (mathjs, currency rates, date parsing, time zones), so each is
 * its own `Evaluator` under `evaluators/`. Detection is not a separate
 * classifier: each evaluator's parser decides whether the input is "its kind"
 * and returns `null` if not. Order resolves the ambiguous cases (currency
 * before math, so "5 USD in EUR" isn't read as arithmetic on undefined symbols).
 *
 * A query no evaluator claims returns `null` and falls through to the normal
 * action search (see `actions.ts`).
 */
const evaluators: Evaluator[] = [math]

/**
 * Returns a `Calculation` when `query` is something the calculator understands,
 * otherwise `null`.
 */
export function evaluate(query: string): Calculation | null {
  const input = normalize(query)
  if (!input) return null

  for (const evaluator of evaluators) {
    try {
      const calculation = evaluator.evaluate(input)
      if (calculation) return calculation
    } catch (error) {
      console.error(`[calculator] evaluator "${evaluator.id}" threw:`, error)
    }
  }
  return null
}

export type { Evaluator } from './types.ts'

import type { Calculation } from '../../shared/types'

/**
 * A calculator evaluator: given the query (already run through the shared
 * `normalize`), either claim it and return a `Calculation`, or return `null` to
 * let the next evaluator — and ultimately the normal action search — have it.
 *
 * The pipeline in `index.ts` tries evaluators in priority order and takes the
 * first non-null result. Detection is the evaluator's own job: its parser *is*
 * the format check. Evaluators must be cheap to reject — the launcher runs the
 * pipeline on every keystroke.
 */
export interface Evaluator {
  /** Stable id, used in logs and tests (e.g. `"math"`, `"currency"`). */
  readonly id: string
  evaluate(input: string): Calculation | null
}

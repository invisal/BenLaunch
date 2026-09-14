import type { Calculation } from "../../shared/types";
import type { Evaluator } from "./types.ts";
import { normalize, normalizeNumbers } from "./normalize.ts";
import { numberLocale } from "./common/locale.ts";
import { timespan } from "./evaluators/timespan/index.ts";
import { finance } from "./evaluators/finance/index.ts";
import { ratio } from "./evaluators/ratio/index.ts";
import { pixels } from "./evaluators/pixels/index.ts";
import { math } from "./evaluators/math/index.ts";
import { currency } from "./evaluators/currency/index.ts";
import { datetime } from "./evaluators/datetime/index.ts";
import { timezone } from "./evaluators/timezone/index.ts";

/**
 * The calculator pipeline.
 *
 *   query ─▶ normalize (shared framing + the user's number format) ─▶ try evaluators in order ─▶ Calculation
 *
 * It's all one feature — "type something, get an answer" — but the compute
 * engines differ (mathjs, currency rates, date parsing, time zones), so each is
 * its own `Evaluator`. Detection is not a separate classifier: each evaluator's
 * parser decides whether the input is "its kind" and returns `null` if not.
 * `math` is the most permissive (it will try to parse almost anything), so the
 * keyword-gated phrase evaluators that `math` would otherwise mangle run
 * before it:
 *
 *  - `timespan` — `1h 30m + 45m`, `9000 seconds` (and before `datetime`, which
 *    would read a bare `90 min` as "in 90 minutes")
 *  - `finance` — `20% off 80`, `15% tip on 42`, `1500 at 6% for 5 years`
 *  - `ratio` — `16:9`, `ratio of 3 to 5` (`math` would read `3/5` as division)
 *  - `pixels` — `2 inches in px at 72 ppi` (`mathjs` has no `px`)
 *
 * A query nobody claims returns `null` and falls through to the normal action
 * search (`actions.ts`). `routing.test.ts` pins the hand-offs.
 */
const evaluators: Evaluator[] = [
  timespan,
  finance,
  ratio,
  pixels,
  math,
  currency,
  datetime,
  timezone,
];

/**
 * Returns a `Calculation` when `query` is something the calculator understands,
 * otherwise `null`.
 */
export function evaluate(query: string): Calculation | null {
  const input = normalizeNumbers(normalize(query), numberLocale());
  if (!input) return null;

  for (const evaluator of evaluators) {
    try {
      const calculation = evaluator.evaluate(input);
      if (calculation) return calculation;
    } catch (error) {
      console.error(`[calculator] evaluator "${evaluator.id}" threw:`, error);
    }
  }
  return null;
}

export type { Evaluator } from "./types.ts";

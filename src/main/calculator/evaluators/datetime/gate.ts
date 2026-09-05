/**
 * Cheap keyword pre-filter, same spirit as `math/gate.ts`: the evaluator runs
 * on every keystroke, so `chrono-node` (a real parser) should only ever be
 * invoked on plausible candidates. Anything without one of these words is
 * certainly not a date phrase in the vocabulary this evaluator understands.
 *
 * Deliberately excludes generic connectors like `in`/`to` — those collide
 * with `math` unit conversion ("5 in ft") and `currency` ("10 usd to eur"),
 * and every real date phrase this evaluator supports also carries one of the
 * words below regardless.
 */
const DATE_KEYWORDS =
  /\b(?:today|tomorrow|yesterday|now|ago|next|last|from|left|between|until|till|quarter|business|monday|tuesday|wednesday|thursday|friday|saturday|sunday|days?|weeks?|months?|years?|hours?)\b/i

export function looksLikeDate(input: string): boolean {
  return DATE_KEYWORDS.test(input)
}

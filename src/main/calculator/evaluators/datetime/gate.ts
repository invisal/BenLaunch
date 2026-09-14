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
  /\b(?:today|tomorrow|yesterday|now|ago|next|last|from|left|between|until|till|quarter|business|weekday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|days?|weeks?|months?|years?|hours?|minutes?|mins?|work\s*days?|work\s*hours?|working|age|old|born|epoch|unix|timestamp|end|start|beginning|christmas|xmas|halloween|thanksgiving|valentine'?s?)\b/i;

/**
 * An ISO date — `2026-12-25` on its own is a date (its weekday), not math —
 * including the start of a timestamp (`2024-03-15T14:30:00Z`, where there's
 * no word boundary before the `T`).
 */
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}(?:\b|T)/;

/**
 * Date/clock arithmetic — `3:45pm + 5`, `August 5 - 3`, `August 5 minus 3`,
 * `2026-01-15 + 2w`, `9:00 + 90m`. Needs *both* a date/clock-looking operand
 * (a `HH:MM`, a `<n>am/pm`, an ISO date, or a `Month <day>`) *and* a trailing
 * `± <number>` (symbol or the `plus`/`minus` word), so it stays off ordinary
 * prose that merely contains one of those.
 */
const DATE_ARITHMETIC =
  /(?:\d{1,2}:\d{2}|\d{1,2}\s?[ap]\.?m\.?\b|\d{4}-\d{2}-\d{2}|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b).*(?:[+-]|\b(?:plus|minus)\b)\s*\d/i;

export function looksLikeDate(input: string): boolean {
  return (
    DATE_KEYWORDS.test(input) ||
    DATE_ARITHMETIC.test(input) ||
    ISO_DATE.test(input)
  );
}

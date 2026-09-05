/**
 * Unit-conversion phrasing `mathjs` doesn't already understand.
 *
 * `mathjs` already carries most of this for free — `10 ft in m`,
 * `29 inches to cm`, `3 teaspoon in ml`, `180 lbs in kg`, `celsius`/
 * `fahrenheit` spelled out, `128 GB to MB`, `100 km/h to mi/h` all resolve
 * correctly today (see `README.md` for the confirmed matrix). This module
 * covers the three gaps that were actually missing, confirmed by testing
 * against the installed `mathjs`:
 *
 *  - bare `C`/`F` for temperature clash with `mathjs`'s Coulomb/Farad units
 *  - `in` as the conversion connector clashes with `in` the inch unit
 *  - a handful of word/abbreviation aliases (`pounds`, `tbsp`, `tsp`, `mph`,
 *    `kmh`/`kph`) that `mathjs` has no built-in alias for
 */

/** Word/abbreviation forms with no built-in `mathjs` alias. */
const UNIT_WORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bpounds?\b/gi, 'lbs'],
  [/\btbsp\b/gi, 'tablespoon'],
  [/\btsp\b/gi, 'teaspoon'],
  [/\bmph\b/gi, 'mi/h'],
  [/\bk(?:m|p)h\b/gi, 'km/h'],
]

/**
 * `in` is both the conversion connector ("10 ft in m") and the inch unit
 * ("5 in" = 5 inches). Only rewrite it to `to` when it's followed by nothing
 * but a trailing unit word through end-of-string — `5 in ft` → `5 to ft`,
 * `10 ft in m` → `10 ft to m` — so a bare `5 in` (nothing after) still means
 * inches.
 */
const IN_AS_CONNECTOR = /\bin\b(?=\s+[a-zA-Z°/]+\s*$)/gi

/**
 * A bare `C`/`F` only means Celsius/Fahrenheit when the whole expression is
 * "convert this temperature" — `23C to F`. Elsewhere `C`/`F` keep meaning
 * `mathjs`'s Coulomb/Farad, so this is deliberately narrow.
 */
const TEMP_CONVERSION = /^(-?\d+(?:\.\d+)?)\s*°?([CF])\s*to\s*°?([CF])$/i

export function rewriteUnits(expression: string): string {
  let out = expression

  for (const [pattern, replacement] of UNIT_WORDS) out = out.replace(pattern, replacement)
  out = out.replace(IN_AS_CONNECTOR, 'to')

  const temp = out.match(TEMP_CONVERSION)
  if (temp) {
    const [, amount, from, to] = temp
    out = `${amount} deg${from.toUpperCase()} to deg${to.toUpperCase()}`
  }

  return out
}

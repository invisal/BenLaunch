/**
 * Unit-conversion phrasing `mathjs` doesn't already understand.
 *
 * `mathjs` already carries most of this for free — `10 ft in m`,
 * `29 inches to cm`, `180 lbs in kg`, `celsius`/`fahrenheit` spelled out,
 * `128 GB to MB`, `100 km/h to mi/h` all resolve correctly (see `README.md`
 * for the confirmed matrix). This module covers the gaps, confirmed by
 * testing against the installed `mathjs`:
 *
 *  - bare `C`/`F` for temperature clash with `mathjs`'s Coulomb/Farad units
 *  - `in` as the conversion connector clashes with `in` the inch unit
 *  - word/abbreviation/symbol forms with no built-in `mathjs` alias
 *    (`pounds`, `mph`, `kmh`, `fl oz`, `29"`, `mbps`)
 *
 * US kitchen units (`tsp`, `tbsp`) and data rates (`Mbps`) are real units
 * defined on the instance — see `definitions.ts`.
 */

/** Word/abbreviation forms with no built-in `mathjs` alias. */
const UNIT_WORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bpounds?\b/gi, "lbs"],
  [/\bmph\b/gi, "mi/h"],
  [/\bk(?:m|p)h\b/gi, "km/h"],
  [/\bfl\.?\s*oz\b/gi, "floz"],
  [/\bfluid\s+ounces?\b/gi, "floz"],
];

/** `mathjs` unit names are case-sensitive: `mbps` → `Mbps`, `GBPS` → `Gbps`, `KBPS` → `kbps`. */
const DATA_RATE = /\b([kmg])bps\b/gi;

/** `29"` / `29 "` / `29″` — a double-quote right after a number is inches. */
const INCH_MARK = /(\d)\s*(?:"|″)/g;

/**
 * `in` is both the conversion connector ("10 ft in m") and the inch unit
 * ("5 in" = 5 inches). Only rewrite it to `to` when it's followed by nothing
 * but a trailing unit word through end-of-string — `10 ft in m` → `10 ft to
 * m` — so a bare `5 in` (nothing after) still means inches.
 */
const IN_AS_CONNECTOR = /\bin\b(?=\s+[a-zA-Z°/]+\s*$)/gi;

/**
 * `5 in ft` — a bare number, then `in`, then a unit. There's no source unit
 * to convert from, so the `in` can only be the inch: `5 inch to ft`.
 */
const BARE_NUMBER_IN = /^(-?\d+(?:\.\d+)?)\s+in\s+([a-zA-Z°/]+)\s*$/i;

/**
 * A bare `C`/`F` only means Celsius/Fahrenheit when the whole expression is
 * "convert this temperature" — `23C to F`. Elsewhere `C`/`F` keep meaning
 * `mathjs`'s Coulomb/Farad, so this is deliberately narrow.
 */
const TEMP_CONVERSION = /^(-?\d+(?:\.\d+)?)\s*°?([CF])\s*to\s*°?([CF])$/i;

export function rewriteUnits(expression: string): string {
  let out = expression;

  for (const [pattern, replacement] of UNIT_WORDS)
    out = out.replace(pattern, replacement);
  out = out.replace(DATA_RATE, (_match, prefix: string) =>
    prefix.toLowerCase() === "k" ? "kbps" : `${prefix.toUpperCase()}bps`,
  );
  out = out.replace(INCH_MARK, "$1 inch");

  const bare = out.match(BARE_NUMBER_IN);
  if (bare) return `${bare[1]} inch to ${bare[2]}`;

  out = out.replace(IN_AS_CONNECTOR, "to");

  const temp = out.match(TEMP_CONVERSION);
  if (temp) {
    const [, amount, from, to] = temp;
    out = `${amount} deg${from.toUpperCase()} to deg${to.toUpperCase()}`;
  }

  return out;
}

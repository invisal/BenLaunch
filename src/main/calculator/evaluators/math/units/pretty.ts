/**
 * `mathjs` unit names → the symbols people write. Display only — `rawValue`
 * keeps `mathjs`'s own spelling so "Use as Input" can feed it straight back
 * into the parser.
 *
 *   degF → °F     mi / h → mph     km / h → km/h     tablespoon → tbsp
 */
const PRETTY: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:degF|fahrenheit)\b/g, "°F"],
  [/\b(?:degC|celsius)\b/g, "°C"],
  [/\bmi ?\/ ?h\b/g, "mph"],
  [/\b(?:teaspoons?|tsp)\b/g, "tsp"],
  [/\b(?:tablespoons?|tbsp)\b/g, "tbsp"],
  [/\bfloz\b/g, "fl oz"],
  [/\blbs\b/g, "lb"],
  // A whole-unit simple rate: `km / h` → `km/h`, `m / s` → `m/s` (compound units untouched).
  [/^([A-Za-z]+) \/ ([A-Za-z]+)$/, "$1/$2"],
];

export function prettyUnit(unit: string): string {
  let out = unit;
  for (const [pattern, replacement] of PRETTY)
    out = out.replace(pattern, replacement);
  return out;
}

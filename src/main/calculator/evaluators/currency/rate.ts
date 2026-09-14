/**
 * Rate-bearing amounts (pere-doc #20) — a price *per* something, converted in
 * both currency and unit:
 *
 *   8 dollars/hour in gbp         → `£5.75/hour`
 *   65 usd/hour in eur/day        → `€1,300.00/day`   (a day is 24 hours)
 *   65 usd per hour in eur/workday → `€433.33/workday` (a workday is 8 hours)
 *   £1.50/L in $/gal              → `$7.14/gal`
 *
 * Units only convert within a dimension (time, volume, mass, length).
 */

interface RateUnit {
  /** Display name, singular. */
  name: string;
  dimension: "time" | "volume" | "mass" | "length";
  /** Size in the dimension's base unit (seconds, litres, kilograms, metres). */
  size: number;
}

const UNITS: ReadonlyArray<readonly [RegExp, RateUnit]> = [
  [/^(?:s|secs?|seconds?)$/i, { name: "second", dimension: "time", size: 1 }],
  [/^(?:mins?|minutes?)$/i, { name: "minute", dimension: "time", size: 60 }],
  [/^(?:h|hrs?|hours?)$/i, { name: "hour", dimension: "time", size: 3600 }],
  [
    /^(?:workdays?|work\s*days?)$/i,
    { name: "workday", dimension: "time", size: 8 * 3600 },
  ],
  [/^(?:d|days?)$/i, { name: "day", dimension: "time", size: 86_400 }],
  [/^(?:wk|weeks?)$/i, { name: "week", dimension: "time", size: 7 * 86_400 }],
  [
    /^(?:mo|months?)$/i,
    { name: "month", dimension: "time", size: 30.436875 * 86_400 },
  ],
  [
    /^(?:yr|years?)$/i,
    { name: "year", dimension: "time", size: 365.2425 * 86_400 },
  ],
  [/^(?:l|litres?|liters?)$/i, { name: "L", dimension: "volume", size: 1 }],
  [
    /^(?:ml|millilit(?:re|er)s?)$/i,
    { name: "ml", dimension: "volume", size: 0.001 },
  ],
  [
    /^(?:gal|gallons?)$/i,
    { name: "gal", dimension: "volume", size: 3.785411784 },
  ],
  [/^(?:kg|kilos?|kilograms?)$/i, { name: "kg", dimension: "mass", size: 1 }],
  [/^(?:g|grams?)$/i, { name: "g", dimension: "mass", size: 0.001 }],
  [/^(?:lbs?|pounds?)$/i, { name: "lb", dimension: "mass", size: 0.45359237 }],
  [
    /^(?:oz|ounces?)$/i,
    { name: "oz", dimension: "mass", size: 0.028349523125 },
  ],
  [/^(?:m|metres?|meters?)$/i, { name: "m", dimension: "length", size: 1 }],
  [
    /^(?:km|kilomet(?:re|er)s?)$/i,
    { name: "km", dimension: "length", size: 1000 },
  ],
  [/^(?:mi|miles?)$/i, { name: "mi", dimension: "length", size: 1609.344 }],
  [/^(?:ft|foot|feet)$/i, { name: "ft", dimension: "length", size: 0.3048 }],
];

export function rateUnit(word: string): RateUnit | null {
  for (const [pattern, unit] of UNITS)
    if (pattern.test(word.trim())) return unit;
  return null;
}

export interface RateQuery {
  /** `"8 dollars"` — the money part, re-parsed by the ordinary currency parser. */
  moneyText: string;
  /** `"gbp"` / `"$"`. */
  targetText: string;
  from: RateUnit;
  to: RateUnit;
}

const PER = String.raw`\s*(?:\/|\bper\s+|\ba\s+)\s*`;
const RATE = new RegExp(
  String.raw`^(.+?)${PER}([a-z]+(?:\s+days?)?)\s+(?:in|to)\s+(.+?)(?:${PER}([a-z]+(?:\s+days?)?))?$`,
  "i",
);

export function parseRate(input: string): RateQuery | null {
  const match = input.trim().match(RATE);
  if (!match) return null;
  const [, moneyText, fromWord, targetText, toWord] = match;
  const from = rateUnit(fromWord);
  const to = toWord ? rateUnit(toWord) : from;
  if (!from || !to || from.dimension !== to.dimension) return null;
  return { moneyText, targetText, from, to };
}

/** Price per `from` → price per `to`. */
export function rescale(price: number, from: RateUnit, to: RateUnit): number {
  return (price * to.size) / from.size;
}

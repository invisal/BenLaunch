import { mathjs } from "../evaluate.ts";
import { formatNumber } from "../../../common/locale.ts";
import { roundDisplay } from "../../../common/precision.ts";
import { prettyUnit } from "./pretty.ts";

/**
 * Automatic unit conversion — a lone quantity with no `in`/`to` target
 * (`10 m`, `5 kg`, `20 C`) converts to its everyday metric/imperial
 * counterpart, like Raycast's v1.43 auto-conversions:
 *
 *   10 m → 32.81 ft  (also 393.7 in)     180 lb → 81.65 kg     20 C → 68 °F
 *
 * Only a curated table of everyday units triggers it — never an arbitrary
 * word (`10 apps`), never data sizes (no obvious counterpart), and single
 * letters that are ambiguous elsewhere (`C`, `F`) only in their uppercase /
 * `°` form. Durations (`90 min`) belong to the `timespan` evaluator.
 */

interface AutoUnit {
  /** The `mathjs` unit the quantity is read as. */
  from: string;
  /** `mathjs` units to convert to — the first is the headline `value`, the rest become `details`. */
  to: readonly string[];
}

const LENGTH = {
  m: { from: "m", to: ["ft", "inch"] },
  cm: { from: "cm", to: ["inch"] },
  mm: { from: "mm", to: ["inch"] },
  km: { from: "km", to: ["mi"] },
  ft: { from: "ft", to: ["m", "cm"] },
  inch: { from: "inch", to: ["cm"] },
  mi: { from: "mi", to: ["km"] },
  yd: { from: "yd", to: ["m"] },
} satisfies Record<string, AutoUnit>;

const MASS = {
  kg: { from: "kg", to: ["lbs"] },
  g: { from: "g", to: ["oz"] },
  lb: { from: "lbs", to: ["kg"] },
  oz: { from: "oz", to: ["g"] },
} satisfies Record<string, AutoUnit>;

const TEMPERATURE = {
  c: { from: "degC", to: ["degF"] },
  f: { from: "degF", to: ["degC"] },
  k: { from: "K", to: ["degC", "degF"] },
} satisfies Record<string, AutoUnit>;

const VOLUME = {
  l: { from: "l", to: ["gal"] },
  ml: { from: "ml", to: ["floz"] },
  gal: { from: "gal", to: ["l"] },
  floz: { from: "floz", to: ["ml"] },
  cup: { from: "cup", to: ["ml"] },
} satisfies Record<string, AutoUnit>;

const SPEED = {
  kmh: { from: "km/h", to: ["mi/h"] },
  mph: { from: "mi/h", to: ["km/h"] },
  ms: { from: "m/s", to: ["km/h", "mi/h"] },
} satisfies Record<string, AutoUnit>;

/** Every accepted spelling → its unit. Keys are matched case-insensitively unless listed in `CASE_SENSITIVE`. */
const WORDS: ReadonlyArray<readonly [readonly string[], AutoUnit]> = [
  [["m", "meter", "meters", "metre", "metres"], LENGTH.m],
  [["cm", "centimeter", "centimeters", "centimetre", "centimetres"], LENGTH.cm],
  [["mm", "millimeter", "millimeters", "millimetre", "millimetres"], LENGTH.mm],
  [["km", "kilometer", "kilometers", "kilometre", "kilometres"], LENGTH.km],
  [["ft", "foot", "feet"], LENGTH.ft],
  [["in", "inch", "inches", '"', "″"], LENGTH.inch],
  [["mi", "mile", "miles"], LENGTH.mi],
  [["yd", "yard", "yards"], LENGTH.yd],
  [["kg", "kilo", "kilos", "kilogram", "kilograms"], MASS.kg],
  [["g", "gram", "grams"], MASS.g],
  [["lb", "lbs", "pound", "pounds"], MASS.lb],
  [["oz", "ounce", "ounces"], MASS.oz],
  [["C", "°C", "°c", "degC", "celsius"], TEMPERATURE.c],
  [["F", "°F", "°f", "degF", "fahrenheit"], TEMPERATURE.f],
  [["K", "kelvin"], TEMPERATURE.k],
  [["l", "liter", "liters", "litre", "litres"], VOLUME.l],
  [["ml", "milliliter", "milliliters", "millilitre", "millilitres"], VOLUME.ml],
  [["gal", "gallon", "gallons"], VOLUME.gal],
  [["fl oz", "floz", "fluid ounce", "fluid ounces"], VOLUME.floz],
  [["cup", "cups"], VOLUME.cup],
  [["km/h", "kmh", "kph"], SPEED.kmh],
  [["mph", "mi/h"], SPEED.mph],
  [["m/s"], SPEED.ms],
];

/** Spellings that only count in exactly this case — `C` is Celsius, `c` is nothing. */
const CASE_SENSITIVE = new Set(["C", "F", "K"]);

function lookup(word: string): AutoUnit | null {
  for (const [spellings, unit] of WORDS) {
    for (const spelling of spellings) {
      if (
        CASE_SENSITIVE.has(spelling)
          ? word === spelling
          : word.toLowerCase() === spelling.toLowerCase()
      ) {
        return unit;
      }
    }
  }
  return null;
}

const QUANTITY = /^(-?\d+(?:\.\d+)?)\s*([a-zA-Z°"″/][a-zA-Z°/ ]*?)\s*$/;

export interface AutoConversion {
  value: string;
  rawValue: string;
  details: { label: string; value: string }[];
}

function convert(
  amount: number,
  from: string,
  to: string,
): { display: string; raw: string } {
  const exact = mathjs.unit(amount, from).toNumber(to);
  return {
    display: `${formatNumber(roundDisplay(exact))} ${prettyUnit(to === "inch" ? "in" : to)}`,
    // Full precision for "Copy Unformatted" — only the display is rounded.
    raw: `${Number(exact.toPrecision(12))} ${to}`,
  };
}

/** `"10 m"` → `{ value: "32.81 ft", details: [{ value: "393.7 in" }] }`, or `null` when it isn't a lone known quantity. */
export function autoConvert(expression: string): AutoConversion | null {
  const match = expression.match(QUANTITY);
  if (!match) return null;
  const unit = lookup(match[2]);
  if (!unit) return null;

  const amount = Number(match[1]);
  const [primary, ...rest] = unit.to.map((to) =>
    convert(amount, unit.from, to),
  );
  return {
    value: primary.display,
    rawValue: primary.raw,
    details: rest.map((r) => ({ label: "", value: r.display })),
  };
}

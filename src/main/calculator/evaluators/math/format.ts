import { mathjs, type EvalResult } from "./evaluate.ts";
import { formatNumber } from "../../common/locale.ts";
import { roundDisplay } from "../../common/precision.ts";
import { formatTimespan } from "../../common/timespan.ts";
import { prettyUnit } from "./units/pretty.ts";

export interface FormattedResult {
  /** For display: thousands grouped, unit suffix kept. */
  value: string;
  /** For pasting into code / feeding back into the search: no grouping. */
  rawValue: string;
}

/** Trim floating-point noise (0.1 + 0.2 → 0.3) without forcing a fixed precision. */
function tidy(value: number): number {
  return Number(value.toPrecision(12));
}

/** A `<number> <unit>` string from `mathjs.format`, split apart. */
const NUMBER_AND_UNIT = /^(-?[\d.]+(?:e[+-]?\d+)?)\s+(.+)$/i;

/** Below/above these, a unit's number keeps `mathjs`'s exponent form instead of being rounded to `0`. */
const TINY = 1e-6;
const HUGE = 1e15;

export function formatResult(result: EvalResult): FormattedResult {
  if (result.kind === "number") {
    const n = tidy(result.value);
    return {
      value: formatNumber(n),
      rawValue: String(n),
    };
  }

  const unit = result.value;
  // `rawValue` stays in `mathjs`'s own syntax so "Use as Input" re-parses it,
  // at full precision — only the display is rounded.
  const rawValue = mathjs.format(unit, {
    notation: "auto",
    precision: 14,
    lowerExp: -9,
    upperExp: 15,
  });

  // A pure duration nobody converted explicitly (`3 GB / 25 Mbps`, `1 h + 30 min`)
  // reads as a timespan. An explicit `… to minutes` keeps the unit asked for.
  const explicitTarget = unit.toJSON().fixPrefix;
  // Months/years aren't fixed lengths — `2 months` stays `2 months`, never `60 days 21 hours`.
  const calendarUnit = /\b(?:months?|years?|decades?|century|centuries)\b/.test(
    unit.formatUnits(),
  );
  if (!explicitTarget && !calendarUnit && unit.equalBase(mathjs.unit("s"))) {
    const seconds = unit.toNumber("s");
    // Raw as plain seconds — `mathjs` would otherwise pick e.g. `9 ks`.
    return { value: formatTimespan(seconds), rawValue: `${tidy(seconds)} s` };
  }

  const match = mathjs.format(unit, { precision: 14 }).match(NUMBER_AND_UNIT);
  if (!match) return { value: prettyUnit(rawValue), rawValue };

  const n = Number(match[1]);
  const abs = Math.abs(n);
  const number =
    abs !== 0 && (abs < TINY || abs >= HUGE)
      ? mathjs.format(n, { precision: 4 })
      : formatNumber(roundDisplay(n));
  return { value: `${number} ${prettyUnit(match[2])}`, rawValue };
}

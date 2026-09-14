import type { Calculation } from "../../../../shared/types";
import { formatNumber } from "../../common/locale.ts";
import { roundDisplay } from "../../common/precision.ts";
import {
  financeResult,
  formatPercentage,
  parseMoney,
  parsePercent,
} from "./money.ts";

/**
 * Interest and growth (pere-doc #20's financial phrasing).
 *
 *   1500 at 6% for 5 years            → `2,007.34`, Gain `507.34`, Multiple `×1.338`
 *   1000 at 5% simple for 10 years    → `1,500`,    Interest `500`
 *   1000 at 5% for 10 years compounded monthly
 *   1000 invested at 7% for 18 months
 *   invested at 7% after 3 years      → `×1.225`, Growth `+22.5%`
 *
 * Compounds annually unless told otherwise.
 */

const PCT = String.raw`(\d+(?:\.\d+)?\s*%)`;
const DURATION = String.raw`(?:for|after|over)\s+(\d+(?:\.\d+)?)\s+(years?|yrs?|months?)`;
const COMPOUND = String.raw`(?:\s+compounded\s+(annually|yearly|semi-?annually|quarterly|monthly|weekly|daily))?`;

const WITH_PRINCIPAL = new RegExp(
  String.raw`^(?:simple\s+interest\s+(?:on\s+)?)?(.+?)\s+(?:invested\s+)?at\s+${PCT}(\s+simple(?:\s+interest)?)?\s+${DURATION}${COMPOUND}$`,
  "i",
);
const GROWTH_ONLY = new RegExp(
  String.raw`^invested\s+at\s+${PCT}\s+${DURATION}${COMPOUND}$`,
  "i",
);

const PERIODS_PER_YEAR: Record<string, number> = {
  annually: 1,
  yearly: 1,
  semiannually: 2,
  "semi-annually": 2,
  quarterly: 4,
  monthly: 12,
  weekly: 52,
  daily: 365,
};

function years(amount: string, unit: string): number {
  return /^month/i.test(unit) ? Number(amount) / 12 : Number(amount);
}

function growth(
  rate: number,
  span: number,
  compounding: string | undefined,
  simple: boolean,
): number {
  if (simple) return 1 + rate * span;
  const n = PERIODS_PER_YEAR[(compounding ?? "annually").toLowerCase()] ?? 1;
  return (1 + rate / n) ** (n * span);
}

const multiple = (factor: number) => `×${formatNumber(roundDisplay(factor))}`;

export function resolveInterest(input: string): Calculation | null {
  const growthOnly = input.match(GROWTH_ONLY);
  if (growthOnly) {
    const [, pct, amount, unit, compounding] = growthOnly;
    const rate = parsePercent(pct);
    if (rate === null) return null;
    const factor = growth(rate, years(amount, unit), compounding, false);
    return {
      expression: input,
      value: multiple(factor),
      rawValue: String(roundDisplay(factor)),
      details: [{ label: "Growth", value: `+${formatPercentage(factor - 1)}` }],
    };
  }

  const match = input.match(WITH_PRINCIPAL);
  if (!match) return null;
  const [, principalText, pct, simpleWord, amount, unit, compounding] = match;
  const simple = Boolean(simpleWord) || /^simple\s+interest/i.test(input);
  if (simple && compounding) return null;

  const principal = parseMoney(principalText);
  const rate = parsePercent(pct);
  if (!principal || rate === null) return null;

  const factor = growth(rate, years(amount, unit), compounding, simple);
  const total = principal.amount * factor;
  const gain = total - principal.amount;

  return financeResult(input, total, principal.currency, [
    { label: simple ? "Interest" : "Gain", amount: gain },
    { label: "Multiple", text: multiple(factor) },
  ]);
}

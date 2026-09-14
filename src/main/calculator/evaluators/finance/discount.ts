import type { Calculation } from "../../../../shared/types";
import {
  financeResult,
  formatPercentage,
  parseMoney,
  parsePercent,
} from "./money.ts";

/**
 * Discounts — "20% off 80" → `64`, You save `16`.
 *
 *   20% off 80              25% discount on £129.99      20% off 80 then 10% off
 *   80 - 20% off            80 with 20% discount          20% off of 80
 */

const PCT = String.raw`(\d+(?:\.\d+)?\s*%)`;
const THEN = new RegExp(
  String.raw`\s+then\s+${PCT}(?:\s+(?:off|discount))?`,
  "gi",
);

const PERCENT_FIRST = new RegExp(
  String.raw`^${PCT}\s+(?:off(?:\s+of)?|discount(?:\s+on)?)\s+(.+?)((?:\s+then\s+${PCT}(?:\s+(?:off|discount))?)*)$`,
  "i",
);
const AMOUNT_FIRST = new RegExp(
  String.raw`^(.+?)\s+(?:-|minus|less|with)\s+${PCT}\s+(?:off|discount)((?:\s+then\s+${PCT}(?:\s+(?:off|discount))?)*)$`,
  "i",
);

export function resolveDiscount(input: string): Calculation | null {
  let percentText: string;
  let moneyText: string;
  let thenText: string;

  const first = input.match(PERCENT_FIRST);
  const second = first ? null : input.match(AMOUNT_FIRST);
  if (first) [, percentText, moneyText, thenText] = first;
  else if (second) [, moneyText, percentText, thenText] = second;
  else return null;

  const money = parseMoney(moneyText);
  const firstPercent = parsePercent(percentText);
  if (!money || firstPercent === null) return null;

  const percents = [firstPercent];
  for (const match of (thenText ?? "").matchAll(THEN)) {
    const p = parsePercent(match[1]);
    if (p === null) return null;
    percents.push(p);
  }
  if (percents.some((p) => p > 1)) return null;

  const price = percents.reduce((amount, p) => amount * (1 - p), money.amount);
  const saved = money.amount - price;
  const details: { label: string; amount?: number; text?: string }[] = [
    { label: "You save", amount: saved },
  ];
  if (percents.length > 1 && money.amount !== 0) {
    details.push({
      label: "Total discount",
      text: formatPercentage(saved / money.amount),
    });
  }
  return financeResult(input, price, money.currency, details);
}

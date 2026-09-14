import type { Calculation } from "../../../../shared/types";
import {
  financeResult,
  formatPercentage,
  parseMoney,
  parsePercent,
} from "./money.ts";

/**
 * Markup and margin — pricing from a cost.
 *
 *   cost 40 markup 25%    40 markup 25%    25% markup on 40    40 + 25% markup
 *     → `50`, Markup `10`, Margin `20%`
 *   30% margin on 70      70 with 30% margin
 *     → `100`, Profit `30`, Markup `42.86%`
 */

const PCT = String.raw`(\d+(?:\.\d+)?\s*%)`;
const COST = String.raw`(?:(?:cost|buy\s+price|price)\s+)?`;

const MARKUP: ReadonlyArray<{
  pattern: RegExp;
  percent: number;
  money: number;
}> = [
  {
    pattern: new RegExp(
      String.raw`^${COST}(.+?)\s+(?:markup|mark\s*up|marked\s+up)(?:\s+by)?\s+${PCT}$`,
      "i",
    ),
    percent: 2,
    money: 1,
  },
  {
    pattern: new RegExp(
      String.raw`^${PCT}\s+(?:markup|mark\s*up)\s+(?:on|of)\s+(.+)$`,
      "i",
    ),
    percent: 1,
    money: 2,
  },
  {
    pattern: new RegExp(
      String.raw`^${COST}(.+?)\s*(?:\+|plus|with)\s*${PCT}\s+(?:markup|mark\s*up)$`,
      "i",
    ),
    percent: 2,
    money: 1,
  },
];

const MARGIN: ReadonlyArray<{
  pattern: RegExp;
  percent: number;
  money: number;
}> = [
  {
    pattern: new RegExp(String.raw`^${PCT}\s+margin\s+(?:on|of)\s+(.+)$`, "i"),
    percent: 1,
    money: 2,
  },
  {
    pattern: new RegExp(
      String.raw`^${COST}(.+?)\s+(?:with|at)\s+${PCT}\s+margin$`,
      "i",
    ),
    percent: 2,
    money: 1,
  },
];

export function resolveMarkup(input: string): Calculation | null {
  for (const shape of MARKUP) {
    const match = input.match(shape.pattern);
    if (!match) continue;
    const cost = parseMoney(match[shape.money]);
    const percent = parsePercent(match[shape.percent]);
    if (!cost || percent === null) return null;

    const markup = cost.amount * percent;
    const price = cost.amount + markup;
    const details: { label: string; amount?: number; text?: string }[] = [
      { label: "Markup", amount: markup },
    ];
    if (price !== 0)
      details.push({ label: "Margin", text: formatPercentage(markup / price) });
    return financeResult(input, price, cost.currency, details);
  }

  for (const shape of MARGIN) {
    const match = input.match(shape.pattern);
    if (!match) continue;
    const cost = parseMoney(match[shape.money]);
    const percent = parsePercent(match[shape.percent]);
    if (!cost || percent === null || percent >= 1) return null;

    const price = cost.amount / (1 - percent);
    const profit = price - cost.amount;
    const details: { label: string; amount?: number; text?: string }[] = [
      { label: "Profit", amount: profit },
    ];
    if (cost.amount !== 0)
      details.push({
        label: "Markup",
        text: formatPercentage(profit / cost.amount),
      });
    return financeResult(input, price, cost.currency, details);
  }

  return null;
}

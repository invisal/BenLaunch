import type { Calculation } from "../../../../shared/types";
import { financeResult, parseMoney, parsePercent } from "./money.ts";

/**
 * Tips — "15% tip on 42" → `6.30`, Total `48.30`.
 *
 *   15% tip on 42        42 + 15% tip        tip 15% on $42
 *   18% tip on 73.50 split 3     (adds Per person)
 */

const PCT = String.raw`(\d+(?:\.\d+)?\s*%)`;
const SPLIT = String.raw`(?:\s+split(?:\s+(?:between|among|by))?\s+(\d+)(?:\s+(?:people|persons|ways))?)?`;

const SHAPES: ReadonlyArray<{
  pattern: RegExp;
  percent: number;
  money: number;
  split: number;
}> = [
  {
    pattern: new RegExp(
      String.raw`^${PCT}\s+tip\s+(?:on|for|of)\s+(.+?)${SPLIT}$`,
      "i",
    ),
    percent: 1,
    money: 2,
    split: 3,
  },
  {
    pattern: new RegExp(
      String.raw`^tip\s+${PCT}\s+(?:on|for|of)\s+(.+?)${SPLIT}$`,
      "i",
    ),
    percent: 1,
    money: 2,
    split: 3,
  },
  {
    pattern: new RegExp(
      String.raw`^(.+?)\s*(?:\+|plus|with)\s*${PCT}\s+tip${SPLIT}$`,
      "i",
    ),
    percent: 2,
    money: 1,
    split: 3,
  },
];

export function resolveTip(input: string): Calculation | null {
  for (const shape of SHAPES) {
    const match = input.match(shape.pattern);
    if (!match) continue;

    const money = parseMoney(match[shape.money]);
    const percent = parsePercent(match[shape.percent]);
    if (!money || percent === null) return null;

    const tip = money.amount * percent;
    const total = money.amount + tip;
    const details: { label: string; amount: number }[] = [
      { label: "Total", amount: total },
    ];

    const people = match[shape.split] ? Number(match[shape.split]) : 0;
    if (people > 1)
      details.push({ label: "Per person", amount: total / people });

    return financeResult(input, tip, money.currency, details);
  }
  return null;
}

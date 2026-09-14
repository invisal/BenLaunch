import type { Calculation } from "../../../../shared/types";
import { financeResult, parseMoney, parsePercent } from "./money.ts";

/**
 * Sales tax / VAT / GST.
 *
 *   £60 + 20% VAT    20% VAT on £60    60 plus 8.25% sales tax   → `£72.00`, Tax `£12.00`
 *   £72 incl 20% VAT (tax-inclusive price, backed out)          → `£60.00`, Tax `£12.00`, Gross `£72.00`
 */

const PCT = String.raw`(\d+(?:\.\d+)?\s*%)`;
const TAX = String.raw`(?:vat|gst|hst|pst|sales\s+tax|tax)`;

const ADD: ReadonlyArray<{ pattern: RegExp; percent: number; money: number }> =
  [
    {
      pattern: new RegExp(
        String.raw`^(.+?)\s*(?:\+|plus|with)\s*${PCT}\s+${TAX}$`,
        "i",
      ),
      percent: 2,
      money: 1,
    },
    {
      pattern: new RegExp(
        String.raw`^${PCT}\s+${TAX}\s+(?:on|of|for)\s+(.+)$`,
        "i",
      ),
      percent: 1,
      money: 2,
    },
    {
      pattern: new RegExp(
        String.raw`^(.+?)\s+(?:excl\.?|excluding|ex\.?|before)\s+${PCT}\s+${TAX}$`,
        "i",
      ),
      percent: 2,
      money: 1,
    },
  ];
/** A price that already includes the tax. */
const INCLUSIVE = new RegExp(
  String.raw`^(.+?)\s+(?:incl\.?|including|inc\.?)\s+${PCT}\s+${TAX}$`,
  "i",
);

export function resolveVat(input: string): Calculation | null {
  const inclusive = input.match(INCLUSIVE);
  if (inclusive) {
    const gross = parseMoney(inclusive[1]);
    const percent = parsePercent(inclusive[2]);
    if (!gross || percent === null) return null;
    const net = gross.amount / (1 + percent);
    return financeResult(input, net, gross.currency, [
      { label: "Tax", amount: gross.amount - net },
      { label: "Gross", amount: gross.amount },
    ]);
  }

  for (const shape of ADD) {
    const match = input.match(shape.pattern);
    if (!match) continue;
    const net = parseMoney(match[shape.money]);
    const percent = parsePercent(match[shape.percent]);
    if (!net || percent === null) return null;
    const tax = net.amount * percent;
    return financeResult(input, net.amount + tax, net.currency, [
      { label: "Tax", amount: tax },
    ]);
  }
  return null;
}

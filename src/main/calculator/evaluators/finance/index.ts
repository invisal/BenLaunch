import type { Calculation } from "../../../../shared/types";
import type { Evaluator } from "../../types.ts";
import { resolveDiscount } from "./discount.ts";
import { resolveInterest } from "./interest.ts";
import { resolveMarkup } from "./markup.ts";
import { resolveTip } from "./tip.ts";
import { resolveVat } from "./vat.ts";

/**
 * The finance evaluator — everyday percentage jobs phrased the way people
 * say them (pere-doc #14, and #20's interest phrasing).
 *
 *   - discount — "20% off 80", "25% off £129.99", "20% off 80 then 10% off"
 *   - tip — "15% tip on 42", "42 + 15% tip", "18% tip on 73.50 split 3"
 *   - markup / margin — "cost 40 markup 25%", "30% margin on 70"
 *   - tax — "£60 + 20% VAT", "8.25% sales tax on 120", "£72 incl 20% VAT"
 *   - interest — "1500 at 6% for 5 years", "invested at 7% after 3 years"
 *
 * The headline `value` is the number most people want (the discounted price,
 * the tip, the total with tax); the rest ride along as `details` chips. A
 * currency on the amount formats every figure in that currency.
 *
 * Runs before `math` (which can't parse any of these), gated on a `%` plus
 * one of the trigger words so ordinary percent math never gets here.
 */
const LOOKS_LIKE_FINANCE =
  /%.*\b(?:off|discount|tip|markup|mark\s*up|margin|vat|gst|hst|pst|tax|at|for|after)\b|\b(?:tip|markup|cost|price|simple|invested)\b.*%/i;

function run(input: string): Calculation | null {
  if (!input.includes("%") || !LOOKS_LIKE_FINANCE.test(input)) return null;
  return (
    resolveDiscount(input) ??
    resolveTip(input) ??
    resolveMarkup(input) ??
    resolveVat(input) ??
    resolveInterest(input)
  );
}

export const finance: Evaluator = { id: "finance", evaluate: run };

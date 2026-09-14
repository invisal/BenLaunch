import type { Calculation } from "../../../../shared/types";
import type { Evaluator } from "../../types.ts";
import { formatNumber } from "../../common/locale.ts";
import { roundDisplay } from "../../common/precision.ts";
import { INCHES_PER, parsePixelQuery } from "./parse.ts";

/**
 * The pixels evaluator — physical units ↔ pixels at a density (pere-doc #21).
 *
 *   2 inches in px at 72 ppi → `144 px`          300 px in mm at 300 dpi → `25.4 mm`
 *   12pt in px               → `16 px` (96 ppi, the CSS reference density)
 *
 * `mathjs` has no `px` (and its `createUnit` is disabled on our instance), so
 * the arithmetic is plain: everything goes through inches. Requires a literal
 * `px` token so ordinary length conversions stay with `math`.
 */
export const DEFAULT_PPI = 96;

const LOOKS_LIKE_PIXELS = /\b(?:px|pixels?)\b/i;

function run(input: string): Calculation | null {
  if (!LOOKS_LIKE_PIXELS.test(input)) return null;
  const query = parsePixelQuery(input);
  if (!query) return null;

  const ppi = query.ppi ?? DEFAULT_PPI;
  const inches =
    query.from === "px"
      ? query.amount / ppi
      : query.amount * INCHES_PER[query.from];
  const exact =
    query.to === "px" ? inches * ppi : inches / INCHES_PER[query.to];

  return {
    expression: input,
    value: `${formatNumber(roundDisplay(exact))} ${query.to}`,
    // Full precision for "Copy Unformatted" — only the display is rounded.
    rawValue: String(Number(exact.toPrecision(12))),
    details: [
      {
        label: "Density",
        value: query.ppi === null ? `${ppi} ppi (default)` : `${ppi} ppi`,
      },
    ],
  };
}

export const pixels: Evaluator = { id: "pixels", evaluate: run };

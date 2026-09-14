import type { Calculation } from "../../../../shared/types";
import type { Evaluator } from "../../types.ts";
import { formatNumber } from "../../common/locale.ts";
import { roundDisplay } from "../../common/precision.ts";
import { aspectName } from "./aspect.ts";
import { parseRatioQuery } from "./parse.ts";
import { simplifyRatio } from "./simplify.ts";

/**
 * The ratio evaluator (pere-doc #22).
 *
 *   - relate two numbers — "ratio of 1920 to 1080" → `16 : 9`, Decimal `1.778`,
 *     Percent `177.78%`, Aspect `16:9 Widescreen`
 *   - scale — "16:9 to 1280" → `1280 : 720`; "16:9 with height 1080" → `1920 : 1080`
 *   - solve a proportion — "3:5 = 9:x" → `15`
 *
 * Runs before `math` (which would read `16:9` as nothing, and `3/5` as a
 * division — so the bare `A/B` form is only a ratio after the `ratio` keyword).
 * Clock times like `10:30` are left for `datetime` (see `parse.ts`).
 */
const LOOKS_LIKE_RATIO = /\bratio\b|\d\s*:\s*\d/i;

/** Ratio terms read like dimensions — `1920 : 1080`, never `1,920 : 1,080`. */
const term = (n: number) =>
  formatNumber(n, { useGrouping: false, maximumFractionDigits: 12 });
const num = (n: number) => term(roundDisplay(n));

/** Full precision for "Copy Unformatted" — float noise trimmed, never display-rounded. */
const exact = (n: number) => Number(n.toPrecision(12));

function ratioDetails(
  a: number,
  b: number,
  [p, q]: [number, number],
): { label: string; value: string }[] {
  const details: { label: string; value: string }[] = [];
  if (b !== 0) {
    details.push({ label: "Decimal", value: num(a / b) });
    details.push({
      label: "Percent",
      value: `${formatNumber(Math.round((a / b) * 10000) / 100)}%`,
    });
  }
  const aspect = aspectName(p, q);
  if (aspect) details.push({ label: "Aspect", value: aspect });
  return details;
}

function run(input: string): Calculation | null {
  if (!LOOKS_LIKE_RATIO.test(input)) return null;
  const query = parseRatioQuery(input);
  if (!query) return null;
  if (query.a === 0 && query.b === 0) return null;

  if (query.kind === "ratio") {
    const simplified = simplifyRatio(query.a, query.b);
    if (!simplified) return null;
    const [p, q] = simplified;
    return {
      expression: input,
      value: `${term(p)} : ${term(q)}`,
      rawValue: `${p}:${q}`,
      details: ratioDetails(query.a, query.b, simplified),
    };
  }

  if (query.kind === "scale") {
    const { a, b, target, side } = query;
    if ((side === "first" ? a : b) === 0) return null;
    const [first, second] =
      side === "first"
        ? [target, (target * b) / a]
        : [(target * a) / b, target];
    const simplified = simplifyRatio(a, b);
    if (!simplified) return null;
    const [p, q] = simplified;
    return {
      expression: input,
      value: `${num(first)} : ${num(second)}`,
      rawValue: `${exact(first)}:${exact(second)}`,
      details: [{ label: "Ratio", value: `${term(p)} : ${term(q)}` }],
    };
  }

  const { a, b, known, unknown } = query;
  if ((unknown === "second" ? a : b) === 0) return null;
  const x = unknown === "second" ? (known * b) / a : (known * a) / b;
  const proportion =
    unknown === "second"
      ? `${num(a)} : ${num(b)} = ${num(known)} : ${num(x)}`
      : `${num(a)} : ${num(b)} = ${num(x)} : ${num(known)}`;
  return {
    expression: input,
    value: num(x),
    rawValue: String(exact(x)),
    details: [{ label: "Proportion", value: proportion }],
  };
}

export const ratio: Evaluator = { id: "ratio", evaluate: run };

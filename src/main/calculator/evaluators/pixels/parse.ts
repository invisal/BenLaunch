/**
 * `<n> <unit> in|to <unit> [at <n> ppi|dpi]` where one side is `px`.
 *
 *   2 inches in px at 72 ppi     1 cm in px at 96 dpi     300 px in mm @ 300dpi     12pt in px
 */

/** Length of one unit, in inches. */
export const INCHES_PER: Readonly<Record<string, number>> = {
  in: 1,
  cm: 1 / 2.54,
  mm: 1 / 25.4,
  pt: 1 / 72,
  pc: 1 / 6,
};

const UNIT_WORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(?:px|pixels?)$/i, "px"],
  [/^(?:in|inch(?:es)?|"|″)$/i, "in"],
  [/^(?:cm|centimet(?:er|re)s?)$/i, "cm"],
  [/^(?:mm|millimet(?:er|re)s?)$/i, "mm"],
  [/^(?:pt|pts|points?)$/i, "pt"],
  [/^(?:pc|picas?)$/i, "pc"],
];

function unitOf(word: string): string | null {
  for (const [pattern, unit] of UNIT_WORDS) if (pattern.test(word)) return unit;
  return null;
}

export interface PixelQuery {
  amount: number;
  from: string;
  to: string;
  /** Pixel density; `null` when the query didn't say (the caller defaults it). */
  ppi: number | null;
}

const QUERY =
  /^(\d+(?:\.\d+)?|\.\d+)\s*([a-z]+|"|″)\s+(?:in|to|as|into)\s+([a-z]+)(?:\s+(?:at|@)\s*(\d+(?:\.\d+)?)\s*(?:ppi|dpi))?$/i;

export function parsePixelQuery(input: string): PixelQuery | null {
  const match = input.trim().match(QUERY);
  if (!match) return null;
  const [, amount, fromWord, toWord, ppi] = match;
  const from = unitOf(fromWord);
  const to = unitOf(toWord);
  if (!from || !to || from === to) return null;
  if (from !== "px" && to !== "px") return null;
  const density = ppi === undefined ? null : Number(ppi);
  if (density === 0) return null;
  return { amount: Number(amount), from, to, ppi: density };
}

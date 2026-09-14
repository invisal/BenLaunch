/**
 * What a ratio query asks for:
 *
 *  - `ratio` — relate two numbers: "ratio of 1920 to 1080", "16:9", "3 to 5 ratio"
 *  - `scale` — keep a ratio, change one side: "16:9 to 1280", "16:9 with height 720"
 *  - `solve` — the missing term of a proportion: "3:5 = 9:x"
 */
export type RatioQuery =
  | { kind: "ratio"; a: number; b: number }
  | {
      kind: "scale";
      a: number;
      b: number;
      target: number;
      side: "first" | "second";
    }
  | {
      kind: "solve";
      a: number;
      b: number;
      known: number;
      unknown: "first" | "second";
    };

const NUM = String.raw`(\d+(?:\.\d+)?|\.\d+)`;
const SEP = String.raw`\s*(?::|to|\/)\s*`;

const RATIO_OF = new RegExp(
  String.raw`^ratio\s+(?:(?:of\s+)?${NUM}${SEP}${NUM}|between\s+${NUM}\s+and\s+${NUM})$`,
  "i",
);
const TRAILING_RATIO = new RegExp(
  String.raw`^${NUM}\s*(?::|to)\s*${NUM}\s+ratio$`,
  "i",
);
const COLON = new RegExp(String.raw`^${NUM}(\s*):(\s*)${NUM}$`);
const SCALE = new RegExp(
  String.raw`^(?:ratio\s+)?${NUM}\s*:\s*${NUM}\s+(?:to|at|for|with|scaled\s+to)\s+(?:(width|height|w|h)\s+(?:of\s+)?)?${NUM}$`,
  "i",
);
const SOLVE_SECOND = new RegExp(
  String.raw`^${NUM}\s*:\s*${NUM}\s*=\s*${NUM}\s*:\s*[x?]$`,
  "i",
);
const SOLVE_FIRST = new RegExp(
  String.raw`^${NUM}\s*:\s*${NUM}\s*=\s*[x?]\s*:\s*${NUM}$`,
  "i",
);

/**
 * `10:30` is a clock time, not a ratio — a tight `H:MM` with H ≤ 23 and MM ≤ 59
 * (two-digit minutes) is left for `datetime`. `16:9`, `1920:1080`, `16 : 10`
 * (spaced) and anything prefixed with `ratio` are ratios.
 */
function looksLikeClock(a: string, spaced: boolean, b: string): boolean {
  return (
    !spaced &&
    /^\d{1,2}$/.test(a) &&
    /^\d{2}$/.test(b) &&
    Number(a) <= 23 &&
    Number(b) <= 59
  );
}

export function parseRatioQuery(input: string): RatioQuery | null {
  const text = input.trim();

  const ratioOf = text.match(RATIO_OF);
  if (ratioOf) {
    const [a, b] =
      ratioOf[1] !== undefined
        ? [ratioOf[1], ratioOf[2]]
        : [ratioOf[3], ratioOf[4]];
    return { kind: "ratio", a: Number(a), b: Number(b) };
  }
  const trailing = text.match(TRAILING_RATIO);
  if (trailing)
    return { kind: "ratio", a: Number(trailing[1]), b: Number(trailing[2]) };

  const colon = text.match(COLON);
  if (colon) {
    const [, a, before, after, b] = colon;
    if (looksLikeClock(a, Boolean(before || after), b)) return null;
    return { kind: "ratio", a: Number(a), b: Number(b) };
  }

  const scale = text.match(SCALE);
  if (scale) {
    const [, a, b, side, target] = scale;
    return {
      kind: "scale",
      a: Number(a),
      b: Number(b),
      target: Number(target),
      side: side && /^h/i.test(side) ? "second" : "first",
    };
  }

  const second = text.match(SOLVE_SECOND);
  if (second) {
    return {
      kind: "solve",
      a: Number(second[1]),
      b: Number(second[2]),
      known: Number(second[3]),
      unknown: "second",
    };
  }
  const first = text.match(SOLVE_FIRST);
  if (first) {
    return {
      kind: "solve",
      a: Number(first[1]),
      b: Number(first[2]),
      known: Number(first[3]),
      unknown: "first",
    };
  }

  return null;
}

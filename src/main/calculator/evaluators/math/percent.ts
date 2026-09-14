/**
 * Percentage phrasing `mathjs` doesn't already understand.
 *
 * `mathjs` (v15+) already gives a trailing `%` the "of the other operand"
 * semantics people expect: `100 + 10%` → `110`, `19m + 47%` → `27.93 m`, bare
 * `47%` → `0.47`. See `evaluate.test.ts` / `README.md` for the confirmed
 * cases — none of that needs rewriting here.
 *
 * The one gap is `of`, which isn't a `mathjs` operator: `X% of Y` has to
 * become `X% * Y` before the parser sees it.
 */

/** `32% of 5` → `32% * 5`. Only touches `of` right after a `%`, so it never
 *  reaches for an unrelated "of" elsewhere in the string. */
const PERCENT_OF = /%\s*of\s+/gi;

/** "percent", "percentage" or a bare "%". */
const PCT = String.raw`(?:percent(?:age)?|%)`;
/** A plain decimal, optionally negative. */
const NUM = String.raw`(-?\d+(?:\.\d+)?|-?\.\d+)`;

/** `what percent(age) is A of B` / `what % is A of B`. */
const PERCENT_OF_QUESTION = new RegExp(
  String.raw`^what\s+${PCT}\s+is\s+${NUM}\s+of\s+${NUM}$`,
  "i",
);
/** `what percentage of B is A`. */
const PERCENT_OF_QUESTION_ALT = new RegExp(
  String.raw`^what\s+${PCT}\s+of\s+${NUM}\s+is\s+${NUM}$`,
  "i",
);
/** `A is what percent of B`. */
const PERCENT_OF_STATEMENT = new RegExp(
  String.raw`^${NUM}\s+is\s+what\s+${PCT}\s+of\s+${NUM}$`,
  "i",
);
/** `percentage change from A to B`, `% increase from A to B`, `percent change 50 to 75`. */
const PERCENT_CHANGE = new RegExp(
  String.raw`^${PCT}\s+(?:change|increase|decrease|difference)\s+(?:from\s+)?${NUM}\s+to\s+${NUM}$`,
  "i",
);
/** `from A to B in percent` / `A to B as a percentage`. */
const PERCENT_CHANGE_TRAILING = new RegExp(
  String.raw`^(?:from\s+)?${NUM}\s+to\s+${NUM}\s+(?:in|as)\s+(?:a\s+)?${PCT}(?:\s+change)?$`,
  "i",
);

export interface PercentQuestion {
  /** The answer as a percentage, e.g. `16` for "what percent is 32 of 200". */
  percent: number;
  /** `share` — A as a percent of B; `change` — the signed change from A to B. */
  kind: "share" | "change";
}

/**
 * `X% of Y` → `X% * Y`, letting `mathjs`'s native percent semantics do the
 * rest. Safe to run unconditionally before the gate — it's a no-op unless a
 * `%` is directly followed by `of`.
 */
export function rewritePercentOf(expression: string): string {
  return expression.replace(PERCENT_OF, "% * ");
}

/**
 * "what percent is A of B" / "what percentage of B is A" — answered directly
 * as a ratio, not routed through `mathjs` (the result is a `%`-suffixed
 * fraction, not a plain number or unit).
 */
export function parsePercentQuestion(
  expression: string,
): PercentQuestion | null {
  const direct = expression.match(PERCENT_OF_QUESTION);
  if (direct) {
    const [, a, b] = direct;
    return ratioOf(Number(a), Number(b));
  }

  const inverted = expression.match(PERCENT_OF_QUESTION_ALT);
  if (inverted) {
    const [, b, a] = inverted;
    return ratioOf(Number(a), Number(b));
  }

  const statement = expression.match(PERCENT_OF_STATEMENT);
  if (statement) {
    const [, a, b] = statement;
    return ratioOf(Number(a), Number(b));
  }

  const change =
    expression.match(PERCENT_CHANGE) ??
    expression.match(PERCENT_CHANGE_TRAILING);
  if (change) {
    const [, from, to] = change;
    return changeOf(Number(from), Number(to));
  }

  return null;
}

function ratioOf(a: number, b: number): PercentQuestion | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return { percent: (a / b) * 100, kind: "share" };
}

function changeOf(from: number, to: number): PercentQuestion | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  return { percent: ((to - from) / Math.abs(from)) * 100, kind: "change" };
}

/** `16%` for a share; `+50%` / `-25%` / `0%` for a change. */
export function formatPercentAnswer(question: PercentQuestion): string {
  const body = `${formatPercent(question.percent)}%`;
  return question.kind === "change" && question.percent > 0 ? `+${body}` : body;
}

/** `16.666...` → `16.67` — trims to a friendly percent, no trailing zeros. */
export function formatPercent(percent: number): string {
  return Number(percent.toFixed(2)).toString();
}

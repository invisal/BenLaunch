/**
 * Shared, evaluator-agnostic cleanup applied to every query before the
 * evaluators see it. Only touches *framing* — the words people wrap around a
 * query regardless of what kind it is:
 *
 *  - question lead-ins — "what is …", "calculate …", "convert …"
 *  - a trailing "=", "equals" or "?"
 *  - runs of whitespace
 *
 * Everything domain-specific (spoken operators → `+`, `dollars` → `USD`, …)
 * belongs in the evaluator that cares — see `evaluators/<name>/normalize.ts`.
 */

/** Question lead-ins people type before a query. */
const LEAD_IN = /^(?:what'?s|what\s+is|calculate|compute|convert)\s+/i;

/** A trailing "=", "equals" or "?" — "2 + 2 =", "5 * 5 equals", "time in tokyo?". */
const TRAILING = /\s*(?:=|equals)?\s*\??\s*$/i;

export function normalize(raw: string): string {
  return raw
    .trim()
    .replace(LEAD_IN, "")
    .replace(TRAILING, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The separators `normalizeNumbers` needs — a `NumberLocale` from `common/locale.ts`. */
interface Separators {
  decimal: string;
  group: string;
}

/** Spaces people type (or paste) as a thousands separator in space-grouped locales. */
const SPACE_GROUPS = [" ", "\u00a0", "\u202f"];

/**
 * Numbers typed in the user's own format → the `.`-decimal, ungrouped form
 * every evaluator parses. Runs on the raw query, before `normalize` collapses
 * whitespace (a French `1 234,5` uses a narrow no-break space as its group).
 *
 *  - a grouping separator is dropped only between a digit and exactly three
 *    more digits: `1,234.5` → `1234.5`, `1.234,5` → `1234,5`, `1’234.5`,
 *    `1 234,5`; `2026-01-15`, `10:30` and `1.5` are untouched
 *  - with a `,` decimal locale, a `,` between digits becomes `.`
 *    (`3,5 + 1` → `3.5 + 1`)
 *  - inside a function call's parentheses a `,` is always an argument
 *    separator (`max(2,5)`, `max(1,234)` stay two arguments)
 */
export function normalizeNumbers(input: string, locale: Separators): string {
  const groups = SPACE_GROUPS.includes(locale.group)
    ? SPACE_GROUPS
    : locale.group && locale.group !== locale.decimal
      ? [locale.group]
      : [];

  let result = "";
  const callStack: boolean[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "(") callStack.push(/[a-z_]\w*\s*$/i.test(input.slice(0, i)));
    else if (ch === ")") callStack.pop();
    const insideCall = callStack.includes(true);
    const afterDigit = /\d/.test(input[i - 1] ?? "");
    const commaInCall = ch === "," && insideCall;

    const isGroup =
      groups.includes(ch) &&
      afterDigit &&
      !commaInCall &&
      /^\d{3}(?!\d)/.test(input.slice(i + 1));
    if (isGroup) continue;

    const isDecimalComma =
      locale.decimal === "," &&
      ch === "," &&
      afterDigit &&
      !commaInCall &&
      /\d/.test(input[i + 1] ?? "");
    result += isDecimalComma ? "." : ch;
  }
  return result;
}

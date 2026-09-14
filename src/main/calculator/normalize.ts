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

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Numbers typed in the user's own format → the `.`-decimal, ungrouped form
 * every evaluator parses. A no-op for `1,234.5` locales (the evaluators
 * already accept `,` grouping); for `1.234,5` / `1 234,5` locales:
 *
 *  - a grouping separator is dropped only between digits and before exactly
 *    three digits (`1.234,5` → `1234,5`; `2026-01-15` and `10:30` untouched)
 *  - a decimal `,` between digits becomes `.` (`3,5 + 1` → `3.5 + 1`), except
 *    inside a function call's parentheses, where `,` separates arguments
 *    (`max(2,5)` stays two arguments)
 */
export function normalizeNumbers(input: string, locale: Separators): string {
  if (locale.decimal === ".") return input;

  let out = input;
  if (locale.group && locale.group !== locale.decimal) {
    const group = new RegExp(
      `(\\d)${escape(locale.group)}(?=\\d{3}(?!\\d))`,
      "g",
    );
    // Repeat so `1.234.567` loses both separators.
    for (let prev = ""; prev !== out;) {
      prev = out;
      out = out.replace(group, "$1");
    }
  }

  if (locale.decimal !== ",") return out;

  let result = "";
  const callStack: boolean[] = [];
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (ch === "(") callStack.push(/[a-z_]\w*\s*$/i.test(out.slice(0, i)));
    else if (ch === ")") callStack.pop();
    const insideCall = callStack.includes(true);
    const decimalComma =
      ch === "," &&
      !insideCall &&
      /\d/.test(out[i - 1] ?? "") &&
      /\d/.test(out[i + 1] ?? "");
    result += decimalComma ? "." : ch;
  }
  return result;
}

/**
 * The number format every evaluator formats (and `normalize.ts` parses) with.
 *
 * A module singleton, like the exchange-rate store: `evaluate()` is
 * synchronous and runs on every keystroke, so the locale is resolved once
 * (`setNumberLocale`, called from `actions.ts` with `app.getLocale()` and the
 * user's Number Format setting) rather than threaded through every call.
 * Defaults to `en-US` so tests and anything that never configures it keep the
 * historic `1,024.5` output.
 */

export interface NumberLocale {
  /** BCP 47 tag handed to `Intl` — e.g. `"en-US"`, `"de-DE"`. */
  tag: string;
  /** Decimal separator, e.g. `"."` or `","`. */
  decimal: string;
  /** Grouping separator, e.g. `","`, `"."`, `" "` (narrow no-break space in `fr`). */
  group: string;
}

/** Separators for `tag`, read from `Intl` itself so no table has to be maintained. */
export function resolveNumberLocale(tag: string): NumberLocale {
  let resolved = "en-US";
  try {
    resolved = new Intl.NumberFormat(tag).resolvedOptions().locale;
  } catch {
    // An invalid tag falls back to en-US rather than breaking the calculator.
  }
  const parts = new Intl.NumberFormat(resolved).formatToParts(11111.1);
  return {
    tag: resolved,
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
    group: parts.find((p) => p.type === "group")?.value ?? ",",
  };
}

const DEFAULT = resolveNumberLocale("en-US");
let current: NumberLocale = DEFAULT;

export function numberLocale(): NumberLocale {
  return current;
}

export function setNumberLocale(tag: string): void {
  current = resolveNumberLocale(tag);
}

/** Back to `en-US` — for tests that switch locale. */
export function resetNumberLocale(): void {
  current = DEFAULT;
}

/** `n` grouped and decimal-separated for the current locale. */
export function formatNumber(
  n: number,
  opts: Intl.NumberFormatOptions = { maximumFractionDigits: 12 },
): string {
  return n.toLocaleString(current.tag, opts);
}

/**
 * The locale tag for a Number Format preference: `system` follows the OS
 * (`app.getLocale()`), `dot` forces `1,234.5`, `comma` forces `1.234,5`.
 */
export function numberLocaleTag(
  preference: "system" | "dot" | "comma",
  systemLocale: string,
): string {
  if (preference === "dot") return "en-US";
  if (preference === "comma") return "de-DE";
  return systemLocale || "en-US";
}

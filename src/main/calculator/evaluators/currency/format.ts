export interface FormattedMoney {
  /** For display: currency symbol + locale grouping, e.g. "£7.42", "¥1,596". */
  value: string;
  /** For pasting: the bare number at the currency's precision, e.g. "7.42". */
  rawValue: string;
}

/**
 * Formats `value` as an amount in `code`. `Intl` picks the right symbol and
 * decimal count per currency (JPY/KRW/VND → 0 decimals). Falls back to
 * "<number> <CODE>" for anything `Intl` doesn't recognise.
 */
export function formatMoney(value: number, code: string): FormattedMoney {
  try {
    const nf = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    });
    const decimals = nf.resolvedOptions().maximumFractionDigits;
    return { value: nf.format(value), rawValue: value.toFixed(decimals) };
  } catch {
    return { value: `${value.toFixed(2)} ${code}`, rawValue: value.toFixed(2) };
  }
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const plural = (n: number, unit: string) =>
  `${n} ${unit}${n === 1 ? "" : "s"} ago`;

/**
 * How long ago the rates were last updated, for the result footnote —
 * "just now", "4 minutes ago", "3 hours ago", "yesterday", "5 days ago",
 * "2 months ago". `ageMs` is milliseconds since the last successful fetch.
 */
export function updatedLabel(ageMs: number): string {
  if (!Number.isFinite(ageMs) || ageMs < 0) return "Rates unavailable";
  if (ageMs < 45_000) return "Updated just now";
  if (ageMs < 45 * MINUTE)
    return `Updated ${plural(Math.round(ageMs / MINUTE), "minute")}`;
  if (ageMs < 22 * HOUR)
    return `Updated ${plural(Math.round(ageMs / HOUR), "hour")}`;
  if (ageMs < 36 * HOUR) return "Updated yesterday";
  if (ageMs < 26 * DAY)
    return `Updated ${plural(Math.round(ageMs / DAY), "day")}`;
  return `Updated ${plural(Math.round(ageMs / (30 * DAY)), "month")}`;
}

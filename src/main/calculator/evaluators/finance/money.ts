import type { Calculation } from "../../../../shared/types";
import {
  CURRENCIES,
  SYMBOL_CHARS,
  resolveCurrency,
} from "../currency/currencies.ts";
import { formatMoney } from "../currency/format.ts";
import { formatNumber } from "../../common/locale.ts";

/**
 * Amounts for the finance phrases — a plain number or money (`£60`, `80 eur`,
 * `USD 1.2k`), and the matching formatter so every figure in one answer
 * (price, "You save", "Total") uses the same currency.
 */

export interface Money {
  amount: number;
  /** ISO code when the amount carried a symbol/code/name, else `null` (a plain number). */
  currency: string | null;
}

/** Every currency this app knows — finance never needs live rates, only the code. */
const KNOWN = new Set(Object.keys(CURRENCIES));

const SYMBOL = `(?:${SYMBOL_CHARS.map((s) => `\\${s}`).join("|")})`;
const MONEY = new RegExp(
  String.raw`^(${SYMBOL})?\s*(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|-?\.\d+)\s*([kmb](?![a-z]))?\s*([a-z]{1,}(?:\s+[a-z]+)?)?$`,
  "i",
);
/** `USD 50` — the code before the number. */
const CODE_FIRST = /^([a-z]{3})\s+(.+)$/i;

/** `"£60"`, `"80 eur"`, `"1.2k usd"`, `"USD 50"`, `"42"` → `Money`; `null` for anything else. */
export function parseMoney(text: string): Money | null {
  const trimmed = text.trim();

  const codeFirst = trimmed.match(CODE_FIRST);
  if (codeFirst) {
    const code = resolveCurrency(codeFirst[1], KNOWN);
    const rest = code ? parseMoney(codeFirst[2]) : null;
    if (code && rest && rest.currency === null)
      return { amount: rest.amount, currency: code };
  }

  const match = trimmed.match(MONEY);
  if (!match) return null;
  const [, symbol, number, magnitude, word] = match;

  const scale = { k: 1e3, m: 1e6, b: 1e9 }[magnitude?.toLowerCase() ?? ""] ?? 1;
  const amount = Number(number.replace(/,/g, "")) * scale;
  if (!Number.isFinite(amount)) return null;

  const byWord = word ? resolveCurrency(word, KNOWN) : null;
  if (word && !byWord) return null;
  const bySymbol = symbol ? resolveCurrency(symbol, KNOWN) : null;
  return { amount, currency: byWord ?? bySymbol };
}

/** `"20%"`, `"8.25 %"` → `0.2`, `0.0825`; `null` otherwise. */
export function parsePercent(text: string): number | null {
  const match = text.trim().match(/^(\d+(?:\.\d+)?|\.\d+)\s*%$/);
  return match ? Number(match[1]) / 100 : null;
}

/** `6.3` → `"6.30"`, `64` → `"64"` — 2 decimals only when there is a fraction; money via `Intl`. */
export function formatAmount(
  amount: number,
  currency: string | null,
): { value: string; rawValue: string } {
  if (currency) return formatMoney(amount, currency);
  const rounded = Math.round(amount * 100) / 100;
  const fractional = !Number.isInteger(rounded);
  return {
    value: formatNumber(
      rounded,
      fractional ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {},
    ),
    rawValue: fractional ? rounded.toFixed(2) : String(rounded),
  };
}

/** `16.666…` → `"16.67%"`. */
export function formatPercentage(fraction: number): string {
  return `${formatNumber(Math.round(fraction * 10000) / 100)}%`;
}

/** Assemble a finance `Calculation`: a headline amount plus labelled extras, all in `currency`. */
export function financeResult(
  input: string,
  headline: number,
  currency: string | null,
  details: ReadonlyArray<{ label: string; amount?: number; text?: string }>,
): Calculation {
  const { value, rawValue } = formatAmount(headline, currency);
  return {
    expression: input,
    value,
    rawValue,
    details: details.map((d) => ({
      label: d.label,
      value: d.text ?? formatAmount(d.amount ?? 0, currency).value,
    })),
  };
}

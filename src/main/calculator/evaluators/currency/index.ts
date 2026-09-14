import type { Calculation } from "../../../../shared/types";
import type { Evaluator } from "../../types.ts";
import { formatNumber } from "../../common/locale.ts";
import { parse } from "./parse.ts";
import { convert } from "./convert.ts";
import { formatMoney, updatedLabel } from "./format.ts";
import {
  cryptoRates,
  formatCrypto,
  isCrypto,
  pricesLabel,
  resolveAsset,
} from "./crypto.ts";
import { parseRate, rescale } from "./rate.ts";
import { parseShorthand } from "./shorthand.ts";
import {
  currentRates,
  ratesUpdatedAgeMs,
} from "../../../sources/calculator/exchange-rate/store.ts";
import type { CryptoPrices } from "../../../sources/calculator/crypto-price/cache.ts";
import { currentCryptoPrices } from "../../../sources/calculator/crypto-price/store.ts";

/** The bits of the rate stores the evaluator needs — an injection seam for tests. */
export interface RateProvider {
  /** ISO code → units per 1 USD. */
  rates(): Record<string, number>;
  /** Milliseconds since the rates were last fetched — drives the "Updated …" footnote. */
  updatedAgeMs(): number;
  /** Live crypto prices, or `null` when disabled / not fetched yet. */
  crypto?(): CryptoPrices | null;
}

/** The live provider, backed by the `exchange-rate` and `crypto-price` sources' shared stores. */
const liveRates: RateProvider = {
  rates: () => currentRates().rates,
  updatedAgeMs: () => ratesUpdatedAgeMs(),
  crypto: () => currentCryptoPrices(),
};

/** `1234.5` → `"1,234.5"`, trailing zeros trimmed — for the expression line. */
function trimAmount(n: number): string {
  return formatNumber(n, { maximumFractionDigits: 8 });
}

function formatAsset(
  amount: number,
  code: string,
): { value: string; rawValue: string } {
  return isCrypto(code)
    ? formatCrypto(amount, code)
    : formatMoney(amount, code);
}

/**
 * Currency conversion against a rate provider — fiat, crypto, and rates per
 * unit. Reads whatever the provider currently holds, synchronously; the
 * numbers are kept fresh by the `exchange-rate` / `crypto-price` sources
 * ([../../../sources/calculator/](../../../sources/calculator/)).
 */
function run(provider: RateProvider, input: string): Calculation | null {
  const prices = provider.crypto?.() ?? null;
  const table = { ...cryptoRates(prices), ...provider.rates() };
  const known = new Set(Object.keys(table));
  const resolve = (token: string) => resolveAsset(token, known);

  const footnote = (codes: string[]) =>
    prices && codes.some(isCrypto)
      ? pricesLabel(prices.fetchedAt)
      : updatedLabel(provider.updatedAgeMs());

  // 8 dollars/hour in gbp → £5.75/hour
  const rate = parseRate(input);
  if (rate) {
    const money = parse(
      `${rate.moneyText} in ${rate.targetText}`,
      known,
      resolve,
    );
    if (money) {
      const converted = convert(money.amount, money.from, money.to, table);
      if (converted !== null) {
        const perUnit = rescale(converted, rate.from, rate.to);
        const { value, rawValue } = formatAsset(perUnit, money.to);
        return {
          expression: `${trimAmount(money.amount)} ${money.from}/${rate.from.name} → ${money.to}/${rate.to.name}`,
          value: `${value}/${rate.to.name}`,
          rawValue,
          footnote: footnote([money.from, money.to]),
        };
      }
    }
  }

  const query = parse(input, known, resolve);
  if (query) {
    // `eth`, `sol`, `dot` are also words — crypto needs an explicit amount.
    const involvesCrypto = isCrypto(query.from) || isCrypto(query.to);
    if (involvesCrypto && !/\d/.test(input)) return null;

    const result = convert(query.amount, query.from, query.to, table);
    if (result === null) return null;

    const { value, rawValue } = formatAsset(result, query.to);
    return {
      expression: `${trimAmount(query.amount)} ${query.from} → ${query.to}`,
      value,
      rawValue,
      footnote: footnote([query.from, query.to]),
    };
  }

  // USD1K → $1,000.00
  const shorthand = parseShorthand(input);
  if (shorthand) {
    const code = resolve(shorthand.token);
    if (!code) return null;
    const { value, rawValue } = formatAsset(shorthand.amount, code);
    return {
      expression: `${trimAmount(shorthand.amount)} ${code}`,
      value,
      rawValue,
    };
  }

  return null;
}

/**
 * The currency evaluator — live fiat and crypto conversion.
 *
 *   "10 usd in gbp", "45 jpy to inr", "$50 in eur", "1.2k dollars in yen",
 *   "eur to usd" (rate for 1), "5 btc in gbp", "1500 usd in eth",
 *   "8 dollars/hour in gbp", "65 usd/hour in eur/day", "USD1K"
 *
 * Non-currency queries return `null` and fall through to the next evaluator /
 * the action search.
 */
export const currency: Evaluator = {
  id: "currency",
  evaluate: (input) => run(liveRates, input),
};

/** Same evaluator bound to an explicit rate provider — for tests. */
export function createCurrencyEvaluator(rates: RateProvider): Evaluator {
  return { id: "currency", evaluate: (input) => run(rates, input) };
}

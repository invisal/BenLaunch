import { CRYPTO_TOKENS } from "../../../sources/calculator/crypto-price/tokens.ts";
import type { CryptoPrices } from "../../../sources/calculator/crypto-price/cache.ts";
import { formatNumber } from "../../common/locale.ts";
import { CURRENCIES, resolveCurrency } from "./currencies.ts";

/**
 * Crypto on top of the fiat pipeline (pere-doc #19). Prices arrive in USD, so
 * each token becomes one more entry in the same "units per 1 USD" table
 * `convert.ts` already uses — `rate[BTC] = 1 / priceUsd` — and crypto↔fiat or
 * crypto↔crypto is the ordinary cross-rate through USD.
 */

const BY_WORD: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const token of CRYPTO_TOKENS) {
    // A ticker that is also a fiat ISO code stays fiat.
    if (token.ticker in CURRENCIES) continue;
    map.set(token.ticker.toLowerCase(), token.ticker);
    map.set(token.name.toLowerCase(), token.ticker);
    for (const alias of token.aliases)
      map.set(alias.toLowerCase(), token.ticker);
  }
  return map;
})();

export function isCrypto(code: string): boolean {
  return BY_WORD.get(code.toLowerCase()) === code;
}

/** `prices.usd` → `{ BTC: 1/64000, … }`, the `convert.ts` table shape. */
export function cryptoRates(
  prices: CryptoPrices | null,
): Record<string, number> {
  const rates: Record<string, number> = {};
  if (!prices) return rates;
  for (const [ticker, usd] of Object.entries(prices.usd)) {
    if (usd > 0 && BY_WORD.has(ticker.toLowerCase())) rates[ticker] = 1 / usd;
  }
  return rates;
}

/**
 * Token → code, knowing crypto: an exact fiat ISO code first (`usd`), then a
 * crypto ticker/name (`sol`, `bitcoin` — so `sol` is Solana, not the Peruvian
 * sol's nickname), then fiat symbols/names (`$`, `euros`, `₿`).
 */
export function resolveAsset(
  token: string,
  known: ReadonlySet<string>,
): string | null {
  const trimmed = token.trim();
  const upper = trimmed.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper) && upper in CURRENCIES && known.has(upper))
    return upper;
  const crypto = BY_WORD.get(trimmed.toLowerCase());
  if (crypto && known.has(crypto)) return crypto;
  return resolveCurrency(trimmed, known);
}

/** `0.0000123 BTC`, `1.2346 ETH`, `64,012.5 USDT` — enough significant digits for small balances. */
export function formatCrypto(
  amount: number,
  ticker: string,
): { value: string; rawValue: string } {
  const abs = Math.abs(amount);
  const opts: Intl.NumberFormatOptions =
    abs >= 1 ? { maximumFractionDigits: 4 } : { maximumSignificantDigits: 6 };
  const raw =
    abs >= 1 ? Number(amount.toFixed(4)) : Number(amount.toPrecision(6));
  return {
    value: `${formatNumber(amount, opts)} ${ticker}`,
    rawValue: String(raw),
  };
}

/** `"Prices as of 14:05"` — crypto moves fast, so the footnote names the fetch time. */
export function pricesLabel(fetchedAt: number): string {
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(fetchedAt);
  return `Prices as of ${time}`;
}

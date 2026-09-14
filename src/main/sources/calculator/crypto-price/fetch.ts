import { CRYPTO_TOKENS } from "./tokens.ts";

/**
 * Live crypto prices in USD from CoinGecko's key-less `simple/price`. Not
 * unit-tested (network); `CryptoPriceSource` takes it as an injectable, and
 * `toTickerPrices` (the payload mapping) is tested on its own.
 */
const ENDPOINT = "https://api.coingecko.com/api/v3/simple/price";
const TIMEOUT_MS = 10_000;

type SimplePriceResponse = Record<string, { usd?: number }>;

/** CoinGecko's `{ bitcoin: { usd: 64000 } }` → `{ BTC: 64000 }`, dropping anything missing or non-positive. */
export function toTickerPrices(
  json: SimplePriceResponse,
): Record<string, number> {
  const usd: Record<string, number> = {};
  for (const token of CRYPTO_TOKENS) {
    const price = json[token.id]?.usd;
    if (typeof price === "number" && price > 0) usd[token.ticker] = price;
  }
  return usd;
}

export async function fetchCryptoPrices(): Promise<Record<string, number>> {
  const ids = CRYPTO_TOKENS.map((t) => t.id).join(",");
  const res = await fetch(`${ENDPOINT}?ids=${ids}&vs_currencies=usd`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`crypto-price: HTTP ${res.status}`);
  const usd = toTickerPrices((await res.json()) as SimplePriceResponse);
  if (Object.keys(usd).length === 0)
    throw new Error("crypto-price: unexpected payload");
  return usd;
}

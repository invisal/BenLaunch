/**
 * The curated crypto tokens the calculator converts — ticker → CoinGecko id,
 * plus the names people type. Kept to well-known assets so parsing stays
 * unambiguous and the price request stays small. Shared by `fetch.ts` (which
 * ids to request) and the `currency` evaluator (which words are crypto).
 */
export interface CryptoToken {
  ticker: string;
  /** CoinGecko `simple/price` id. */
  id: string;
  name: string;
  aliases: readonly string[];
}

export const CRYPTO_TOKENS: readonly CryptoToken[] = [
  {
    ticker: "BTC",
    id: "bitcoin",
    name: "Bitcoin",
    aliases: ["bitcoin", "bitcoins", "xbt"],
  },
  {
    ticker: "ETH",
    id: "ethereum",
    name: "Ethereum",
    aliases: ["ethereum", "ether"],
  },
  { ticker: "USDT", id: "tether", name: "Tether", aliases: ["tether"] },
  { ticker: "BNB", id: "binancecoin", name: "BNB", aliases: ["binance coin"] },
  { ticker: "SOL", id: "solana", name: "Solana", aliases: ["solana"] },
  { ticker: "XRP", id: "ripple", name: "XRP", aliases: ["ripple"] },
  { ticker: "USDC", id: "usd-coin", name: "USD Coin", aliases: ["usd coin"] },
  { ticker: "ADA", id: "cardano", name: "Cardano", aliases: ["cardano"] },
  { ticker: "DOGE", id: "dogecoin", name: "Dogecoin", aliases: ["dogecoin"] },
  { ticker: "TRX", id: "tron", name: "TRON", aliases: ["tron"] },
  {
    ticker: "TON",
    id: "the-open-network",
    name: "Toncoin",
    aliases: ["toncoin"],
  },
  {
    ticker: "AVAX",
    id: "avalanche-2",
    name: "Avalanche",
    aliases: ["avalanche"],
  },
  {
    ticker: "SHIB",
    id: "shiba-inu",
    name: "Shiba Inu",
    aliases: ["shiba inu"],
  },
  { ticker: "DOT", id: "polkadot", name: "Polkadot", aliases: ["polkadot"] },
  {
    ticker: "LINK",
    id: "chainlink",
    name: "Chainlink",
    aliases: ["chainlink"],
  },
  {
    ticker: "BCH",
    id: "bitcoin-cash",
    name: "Bitcoin Cash",
    aliases: ["bitcoin cash"],
  },
  { ticker: "LTC", id: "litecoin", name: "Litecoin", aliases: ["litecoin"] },
  { ticker: "NEAR", id: "near", name: "NEAR Protocol", aliases: [] },
  {
    ticker: "POL",
    id: "polygon-ecosystem-token",
    name: "Polygon",
    aliases: ["polygon", "matic"],
  },
  { ticker: "UNI", id: "uniswap", name: "Uniswap", aliases: ["uniswap"] },
  {
    ticker: "XLM",
    id: "stellar",
    name: "Stellar",
    aliases: ["stellar", "lumens"],
  },
  {
    ticker: "ICP",
    id: "internet-computer",
    name: "Internet Computer",
    aliases: [],
  },
  { ticker: "DAI", id: "dai", name: "Dai", aliases: [] },
  {
    ticker: "ETC",
    id: "ethereum-classic",
    name: "Ethereum Classic",
    aliases: ["ethereum classic"],
  },
  { ticker: "APT", id: "aptos", name: "Aptos", aliases: ["aptos"] },
  { ticker: "XMR", id: "monero", name: "Monero", aliases: ["monero"] },
  { ticker: "ATOM", id: "cosmos", name: "Cosmos", aliases: ["cosmos"] },
  { ticker: "FIL", id: "filecoin", name: "Filecoin", aliases: ["filecoin"] },
  {
    ticker: "HBAR",
    id: "hedera-hashgraph",
    name: "Hedera",
    aliases: ["hedera"],
  },
  { ticker: "ARB", id: "arbitrum", name: "Arbitrum", aliases: ["arbitrum"] },
  { ticker: "OP", id: "optimism", name: "Optimism", aliases: ["optimism"] },
  { ticker: "VET", id: "vechain", name: "VeChain", aliases: ["vechain"] },
  { ticker: "SUI", id: "sui", name: "Sui", aliases: [] },
  { ticker: "PEPE", id: "pepe", name: "Pepe", aliases: [] },
  { ticker: "ALGO", id: "algorand", name: "Algorand", aliases: ["algorand"] },
  { ticker: "AAVE", id: "aave", name: "Aave", aliases: [] },
  { ticker: "XTZ", id: "tezos", name: "Tezos", aliases: ["tezos"] },
  { ticker: "EOS", id: "eos", name: "EOS", aliases: [] },
];

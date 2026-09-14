import { SYMBOL_CHARS } from "./currencies.ts";

/**
 * A bare money amount written with a magnitude suffix — `USD1K`, `EUR 2.5M`,
 * `10k usd`, `$1.5k` — expands to the full amount (pere-doc #3). No target
 * currency needed. The suffix is required, so `10 usd` or a plain `$5` stays
 * out of the calculator.
 */
const AMOUNT = String.raw`(\d+(?:\.\d+)?|\.\d+)\s*([kmb])`;
const SYMBOL = `(${SYMBOL_CHARS.map((s) => `\\${s}`).join("|")})`;

const CODE_FIRST = new RegExp(String.raw`^([a-z]{3})\s*${AMOUNT}$`, "i");
const AMOUNT_FIRST = new RegExp(
  String.raw`^${AMOUNT}\s+([a-z]+(?:\s+[a-z]+)?)$`,
  "i",
);
const SYMBOL_FIRST = new RegExp(String.raw`^${SYMBOL}\s*${AMOUNT}$`, "i");

const SCALE: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

export interface Shorthand {
  amount: number;
  /** The currency token as typed — resolved by the caller. */
  token: string;
}

export function parseShorthand(input: string): Shorthand | null {
  const text = input.trim();
  const codeFirst = text.match(CODE_FIRST);
  if (codeFirst)
    return {
      token: codeFirst[1],
      amount: Number(codeFirst[2]) * SCALE[codeFirst[3].toLowerCase()],
    };
  const amountFirst = text.match(AMOUNT_FIRST);
  if (amountFirst)
    return {
      token: amountFirst[3],
      amount: Number(amountFirst[1]) * SCALE[amountFirst[2].toLowerCase()],
    };
  const symbolFirst = text.match(SYMBOL_FIRST);
  if (symbolFirst)
    return {
      token: symbolFirst[1],
      amount: Number(symbolFirst[2]) * SCALE[symbolFirst[3].toLowerCase()],
    };
  return null;
}

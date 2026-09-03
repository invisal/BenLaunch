import type { Calculation } from "../../../../shared/types";
import type { Evaluator } from "../../types.ts";
import { parse } from "./parse.ts";
import { convert } from "./convert.ts";
import { formatMoney, updatedLabel } from "./format.ts";
import {
  currentRates,
  ratesUpdatedAgeMs,
} from "../../../sources/calculator/exchange-rate/store.ts";

/** The bits of the exchange-rate store the evaluator needs — an injection seam for tests. */
export interface RateProvider {
  /** ISO code → units per 1 USD. */
  rates(): Record<string, number>;
  /** Milliseconds since the rates were last fetched — drives the "Updated …" footnote. */
  updatedAgeMs(): number;
}

/** The live provider, backed by the `exchange-rate` source's shared store. */
const liveRates: RateProvider = {
  rates: () => currentRates().rates,
  updatedAgeMs: () => ratesUpdatedAgeMs(),
};

/** `1234.5` → `"1,234.5"`, trailing zeros trimmed — for the expression line. */
function trimAmount(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/**
 * Currency conversion against a rate provider. Reads whatever the provider
 * currently holds — synchronous; the numbers are kept fresh by the
 * `exchange-rate` source ([../../../sources/calculator/exchange-rate](../../../sources/calculator/exchange-rate)).
 */
function run(rates: RateProvider, input: string): Calculation | null {
  const table = rates.rates();

  const query = parse(input, new Set(Object.keys(table)));
  if (!query) return null;

  const result = convert(query.amount, query.from, query.to, table);
  if (result === null) return null;

  const { value, rawValue } = formatMoney(result, query.to);

  return {
    expression: `${trimAmount(query.amount)} ${query.from} → ${query.to}`,
    value,
    rawValue,
    footnote: updatedLabel(rates.updatedAgeMs()),
  };
}

/**
 * The currency evaluator — live fiat conversion.
 *
 *   "10 usd in gbp", "45 jpy to inr", "$50 in eur", "1.2k dollars in yen",
 *   "eur to usd" (rate for 1)
 *
 * Non-currency queries return `null` and fall through to `math` / the action
 * search.
 */
export const currency: Evaluator = {
  id: "currency",
  evaluate: (input) => run(liveRates, input),
};

/** Same evaluator bound to an explicit rate provider — for tests. */
export function createCurrencyEvaluator(rates: RateProvider): Evaluator {
  return { id: "currency", evaluate: (input) => run(rates, input) };
}

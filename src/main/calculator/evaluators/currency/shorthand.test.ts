import assert from "node:assert/strict";
import { test } from "node:test";

import { parseShorthand } from "./shorthand.ts";

for (const [input, expected] of [
  ["USD1K", { token: "USD", amount: 1000 }],
  ["EUR 2.5M", { token: "EUR", amount: 2_500_000 }],
  ["10k usd", { token: "usd", amount: 10_000 }],
  ["1.2b yen", { token: "yen", amount: 1_200_000_000 }],
  ["$1.5k", { token: "$", amount: 1500 }],
  ["10 usd", null], // no magnitude suffix
  ["$5", null],
  ["1k", null],
  ["USD1K in eur", null], // a conversion, not bare shorthand
] as const) {
  test(`parseShorthand(${JSON.stringify(input)})`, () => {
    assert.deepEqual(parseShorthand(input), expected);
  });
}

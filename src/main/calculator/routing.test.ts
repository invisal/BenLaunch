import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluate } from "./index.ts";

/**
 * Which evaluator claims an ambiguous query — the pipeline's ordering
 * contract, end to end. Every evaluator's own suite proves its grammar; this
 * table proves the *hand-off*: that an earlier, greedier evaluator doesn't
 * steal a query meant for a later one, and that bare trigger words (a user
 * searching for "ratio" or "time") fall through to the action search.
 *
 * `expect` is the exact `value`, a `RegExp` for results that depend on the
 * live clock / rate table, or `null` for "no calculator row".
 *
 * Every phase that adds a grammar adds its rows here.
 */
const rows: ReadonlyArray<{ query: string; expect: string | RegExp | null }> = [
  // math
  { query: "5 inch in cm", expect: "12.7 cm" },
  { query: "10 ft in m", expect: "3.048 m" },
  { query: "19m + 47%", expect: "27.93 m" },
  { query: "32% of 5", expect: "1.6" },
  { query: "5 in ft", expect: "0.4167 ft" },
  { query: "10 m", expect: "32.81 ft" },
  { query: "20 C", expect: "68 °F" },
  { query: "3 GB / 25 Mbps", expect: "16 minutes" },
  { query: "log(1000)", expect: "3" },
  { query: "what % is 20 of 80", expect: "25%" },
  { query: "250 - 10%", expect: "225" },
  // timespan
  { query: "90 min", expect: "1 hour 30 minutes" },
  { query: "9000 seconds", expect: "2 hours 30 minutes" },
  { query: "1h 30m + 45m", expect: "2 hours 15 minutes" },
  { query: "145 mins to timespan", expect: "2 hours 25 minutes" },
  { query: "90 minutes in seconds", expect: "5,400 seconds" },
  { query: "45m", expect: /ft$/ }, // bare metres, not minutes
  // finance
  { query: "20% off 80", expect: "64" },
  { query: "15% tip on 42", expect: "6.30" },
  { query: "£60 + 20% VAT", expect: "£72.00" },
  { query: "1500 at 6% for 5 years", expect: "2,007.34" },
  // ratio
  { query: "ratio of 3 to 5", expect: "3 : 5" },
  { query: "16:9", expect: "16 : 9" },
  { query: "3/5", expect: "0.6" },
  // pixels
  { query: "2 inches in px at 72 ppi", expect: "144 px" },
  { query: "12pt in px", expect: "16 px" },
  // currency
  { query: "10 usd to eur", expect: /^€/ },
  { query: "$50 in eur", expect: /^€/ },
  { query: "USD1K", expect: "$1,000.00" },
  { query: "8 dollars/hour in gbp", expect: /^£[\d.]+\/hour$/ },
  { query: "65 usd/hour in eur/day", expect: /^€[\d,.]+\/day$/ },
  // datetime
  { query: "3:45pm + 5", expect: "8:45 PM" },
  { query: "August 5 + 5", expect: /Aug 10/ },
  { query: "in 3 days", expect: /^\w{3}, / },
  { query: "in 90 min", expect: /^\w{3}, / },
  { query: "35 days ago", expect: /^\w{3}, / },
  { query: "2024-03-15T14:30:00Z", expect: /Mar 15, 2024/ },
  { query: "epoch 1700000000", expect: /Nov 1[45], 2023/ },
  { query: "workhours in 2026", expect: "2,088 hours" },
  { query: "workdays in March 2026", expect: "22 workdays" },
  { query: "55h in workdays", expect: "6.875 workdays" },
  { query: "age from 1990-05-01", expect: /^\d+ years$/ },
  { query: "days until christmas", expect: /^\d+ days?$/ },
  { query: "first friday of next month", expect: /^Fri, / },
  { query: "monday in 3 weeks", expect: /^Mon, / },
  { query: "10:30", expect: null }, // a clock time alone is not a ratio
  { query: "2026-01-15 + 3 weeks", expect: /Feb 5/ },
  // timezone
  { query: "time in Tokyo", expect: /GMT\+9/ },
  { query: "5pm ldn in sf", expect: /^09:00/ },
  {
    query: "time difference between London and New York",
    expect: "London is 5 hours ahead of New York",
  },
  { query: "2026-03-15 14:00 UTC in Tokyo", expect: "23:00 Sun, Mar 15" },
  { query: "5pm tomorrow in tokyo", expect: /^\d{2}:\d{2} \w{3}, / },

  // plain searches — never a calculator row
  { query: "office", expect: null },
  { query: "ratio", expect: null },
  { query: "tip", expect: null },
  { query: "time", expect: null },
  { query: "diff", expect: null },
  { query: "monday.com", expect: null },
  { query: "workdays", expect: null },
  { query: "history", expect: null },
  { query: "px", expect: null },
  { query: "btc", expect: null },
  { query: "42", expect: null },
];

for (const { query, expect } of rows) {
  test(`routing: ${JSON.stringify(query)} -> ${expect === null ? "null" : String(expect)}`, () => {
    const calc = evaluate(query);
    if (expect === null) {
      assert.equal(
        calc,
        null,
        `expected no calculation, got ${JSON.stringify(calc?.value)}`,
      );
      return;
    }
    assert.ok(calc, `expected ${JSON.stringify(query)} to resolve`);
    if (typeof expect === "string") assert.equal(calc.value, expect);
    else assert.match(calc.value, expect);
  });
}

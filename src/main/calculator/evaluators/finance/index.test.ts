import assert from "node:assert/strict";
import { test } from "node:test";

import { finance } from "./index.ts";

/** Every pere-doc #14 example, #20's interest phrasing, and the adjacent shapes. */
const cases: ReadonlyArray<{
  input: string;
  value: string;
  rawValue?: string;
  details: string[];
}> = [
  // --- discount ---------------------------------------------------------
  {
    input: "20% off 80",
    value: "64",
    rawValue: "64",
    details: ["You save 16"],
  },
  {
    input: "25% off 129.99",
    value: "97.49",
    rawValue: "97.49",
    details: ["You save 32.50"],
  },
  {
    input: "25% off $129.99",
    value: "$97.49",
    rawValue: "97.49",
    details: ["You save $32.50"],
  },
  { input: "20% discount on 80", value: "64", details: ["You save 16"] },
  { input: "20% off of 80", value: "64", details: ["You save 16"] },
  { input: "80 - 20% off", value: "64", details: ["You save 16"] },
  {
    input: "80 eur with 20% discount",
    value: "€64.00",
    details: ["You save €16.00"],
  },
  {
    input: "20% off 80 then 10% off",
    value: "57.60",
    details: ["You save 22.40", "Total discount 28%"],
  },
  {
    input: "50% off 200 then 50% off then 50%",
    value: "25",
    details: ["You save 175", "Total discount 87.5%"],
  },
  { input: "10% off 1.2k", value: "1,080", details: ["You save 120"] },
  // --- tip --------------------------------------------------------------
  {
    input: "15% tip on 42",
    value: "6.30",
    rawValue: "6.30",
    details: ["Total 48.30"],
  },
  { input: "18% tip on 73.50", value: "13.23", details: ["Total 86.73"] },
  { input: "42 + 15% tip", value: "6.30", details: ["Total 48.30"] },
  { input: "tip 15% on $42", value: "$6.30", details: ["Total $48.30"] },
  { input: "USD 50 + 10% tip", value: "$5.00", details: ["Total $55.00"] },
  {
    input: "18% tip on 73.50 split 3",
    value: "13.23",
    details: ["Total 86.73", "Per person 28.91"],
  },
  {
    input: "20% tip on 100 split between 4 people",
    value: "20",
    details: ["Total 120", "Per person 30"],
  },
  // --- markup / margin --------------------------------------------------
  {
    input: "cost 40 markup 25%",
    value: "50",
    details: ["Markup 10", "Margin 20%"],
  },
  { input: "40 markup 25%", value: "50", details: ["Markup 10", "Margin 20%"] },
  {
    input: "25% markup on 40",
    value: "50",
    details: ["Markup 10", "Margin 20%"],
  },
  {
    input: "40 + 25% markup",
    value: "50",
    details: ["Markup 10", "Margin 20%"],
  },
  {
    input: "buy price 12 markup 40%",
    value: "16.80",
    details: ["Markup 4.80", "Margin 28.57%"],
  },
  {
    input: "30% margin on 70",
    value: "100",
    details: ["Profit 30", "Markup 42.86%"],
  },
  {
    input: "70 with 30% margin",
    value: "100",
    details: ["Profit 30", "Markup 42.86%"],
  },
  // --- tax --------------------------------------------------------------
  {
    input: "£60 + 20% VAT",
    value: "£72.00",
    rawValue: "72.00",
    details: ["Tax £12.00"],
  },
  { input: "20% VAT on £60", value: "£72.00", details: ["Tax £12.00"] },
  { input: "60 plus 8.25% sales tax", value: "64.95", details: ["Tax 4.95"] },
  { input: "100 + 10% GST", value: "110", details: ["Tax 10"] },
  { input: "100 excl 20% vat", value: "120", details: ["Tax 20"] },
  {
    input: "£72 incl 20% VAT",
    value: "£60.00",
    details: ["Tax £12.00", "Gross £72.00"],
  },
  // --- interest ---------------------------------------------------------
  {
    input: "1500 at 6% for 5 years",
    value: "2,007.34",
    rawValue: "2007.34",
    details: ["Gain 507.34", "Multiple ×1.338"],
  },
  {
    input: "1000 at 5% simple for 10 years",
    value: "1,500",
    details: ["Interest 500", "Multiple ×1.5"],
  },
  {
    input: "simple interest on 1000 at 5% for 10 years",
    value: "1,500",
    details: ["Interest 500", "Multiple ×1.5"],
  },
  {
    input: "1000 at 5% for 10 years compounded monthly",
    value: "1,647.01",
    details: ["Gain 647.01", "Multiple ×1.647"],
  },
  {
    input: "1000 usd invested at 7% for 18 months",
    value: "$1,106.82",
    details: ["Gain $106.82", "Multiple ×1.107"],
  },
  {
    input: "invested at 7% after 3 years",
    value: "×1.225",
    rawValue: "1.225",
    details: ["Growth +22.5%"],
  },
];

for (const { input, value, rawValue, details } of cases) {
  test(`finance.evaluate(${JSON.stringify(input)}) -> ${value}`, () => {
    const calc = finance.evaluate(input);
    assert.ok(calc, `expected ${JSON.stringify(input)} to resolve`);
    assert.equal(calc.expression, input);
    assert.equal(calc.value, value);
    if (rawValue !== undefined) assert.equal(calc.rawValue, rawValue);
    assert.deepEqual(
      calc.details?.map((d) => `${d.label} ${d.value}`),
      details,
    );
  });
}

for (const input of [
  "",
  "tip",
  "20% off",
  "off 80",
  "250 - 10%", // plain percent math → math
  "32% of 5",
  "850 + 8.25%",
  "120% off 80", // more than 100% off
  "20% off eighty",
  "20% off 80 apples",
  "100% margin on 50", // infinite price
  "meet at 5% for fun",
  "1000 at 5% simple for 10 years compounded monthly",
  "15% tip",
  "discount code 20%",
]) {
  test(`finance.evaluate(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(finance.evaluate(input), null);
  });
}

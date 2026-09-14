import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveCountdown } from "./countdown.ts";

const NOW = new Date(2026, 8, 5, 10, 0, 0); // Sat 5 Sep 2026

test("days until a date", () => {
  const calc = resolveCountdown("days until 25 Dec", NOW);
  assert.ok(calc);
  assert.equal(calc.value, "111 days");
  assert.equal(calc.rawValue, "111");
});

test("weeks until a date", () => {
  const calc = resolveCountdown("weeks until 2026-12-01", NOW);
  assert.ok(calc);
  assert.equal(calc.value.endsWith("weeks"), true);
});

test("days left in the month", () => {
  const calc = resolveCountdown("days left in the month", NOW);
  assert.ok(calc);
  assert.equal(calc.value, "26 days");
});

test("days left in the quarter (Q3 ends 30 Sep)", () => {
  const calc = resolveCountdown("days left in the quarter", NOW);
  assert.ok(calc);
  assert.equal(calc.value, "26 days");
});

test("days left in the year", () => {
  const calc = resolveCountdown("days left in the year", NOW);
  assert.ok(calc);
  assert.equal(calc.value, "118 days");
});

test("rejects a target already in the past", () => {
  assert.equal(resolveCountdown("days until 1 Jan 2020", NOW), null);
});

for (const input of ["5 + 3", "chrome", "", "days between 1 Jan and 1 Apr"]) {
  test(`resolveCountdown(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(resolveCountdown(input, NOW), null);
  });
}

test("time until a bare year → the exact calendar span", () => {
  const calc = resolveCountdown("time until 2027", NOW);
  assert.ok(calc);
  assert.equal(calc.value, "3 months 26 days 14 hours");
  assert.deepEqual(calc.details, [{ label: "On", value: "Fri, Jan 1, 2027" }]);
});

test("how long until a holiday", () => {
  assert.equal(
    resolveCountdown("how long until halloween", NOW)?.value,
    "1 month 25 days 14 hours",
  );
  assert.equal(
    resolveCountdown("how long is it until christmas", NOW)?.value,
    "3 months 19 days 14 hours",
  );
});

test("unit countdowns to years, quarters and holidays", () => {
  assert.equal(resolveCountdown("months until 2027", NOW)?.value, "4 months");
  assert.equal(resolveCountdown("weeks until Q4", NOW)?.value, "4 weeks");
  assert.equal(resolveCountdown("days until Q1 2027", NOW)?.value, "118 days");
  assert.equal(
    resolveCountdown("days until christmas", NOW)?.value,
    "111 days",
  );
  assert.equal(resolveCountdown("days until new year", NOW)?.value, "118 days");
});

test("time left in the period counts to the closing midnight", () => {
  const calc = resolveCountdown("time left in the year", NOW);
  assert.equal(calc?.value, "3 months 26 days 14 hours");
  assert.deepEqual(calc?.details, [{ label: "Ends", value: "Thu, Dec 31" }]);
  assert.equal(
    resolveCountdown("time left in this month", NOW)?.value,
    "25 days 14 hours",
  );
});

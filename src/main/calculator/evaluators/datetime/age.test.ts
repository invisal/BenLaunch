import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveAge } from "./age.ts";

const NOW = new Date(2026, 8, 5, 10, 0, 0); // Sat 5 Sep 2026

for (const { input, value, exact, next } of [
  {
    input: "age from 1990-05-01",
    value: "36 years",
    exact: "36 years 4 months 4 days",
    next: "Sat, May 1, 2027 (in 238 days)",
  },
  {
    input: "age of 8 Dec 1988",
    value: "37 years",
    exact: "37 years 8 months 28 days",
    next: "Tue, Dec 8 (in 94 days)",
  },
  {
    input: "how old is someone born 8 Dec 1988",
    value: "37 years",
    exact: "37 years 8 months 28 days",
    next: "Tue, Dec 8 (in 94 days)",
  },
  {
    input: "how old am i if i was born on 2000-09-06",
    value: "25 years",
    exact: "25 years 11 months 30 days",
    next: "Sun, Sep 6 (in 1 day)",
  },
  {
    input: "age since 2025-09-05",
    value: "1 year",
    exact: "1 year",
    next: "today 🎂",
  },
  {
    input: "born 1990-05-01 age",
    value: "36 years",
    exact: "36 years 4 months 4 days",
    next: "Sat, May 1, 2027 (in 238 days)",
  },
]) {
  test(`resolveAge(${JSON.stringify(input)}) -> ${value}`, () => {
    const calc = resolveAge(input, NOW);
    assert.ok(calc);
    assert.equal(calc.value, value);
    assert.deepEqual(calc.details, [
      { label: "Exact", value: exact },
      { label: "Next birthday", value: next },
    ]);
  });
}

for (const input of [
  "age of 2030-01-01", // not born yet
  "age from 8 Dec", // no year
  "age of empires",
  "how old is the universe",
  "age",
]) {
  test(`resolveAge(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(resolveAge(input, NOW), null);
  });
}

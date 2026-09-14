import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addBusinessDays,
  businessDaysBetween,
  isBusinessDay,
} from "./business.ts";

const FRI = new Date(2026, 8, 4); // Fri 4 Sep 2026
const SAT = new Date(2026, 8, 5);

test("isBusinessDay", () => {
  assert.equal(isBusinessDay(FRI), true);
  assert.equal(isBusinessDay(SAT), false);
  assert.equal(isBusinessDay(new Date(2026, 8, 6)), false);
});

test("addBusinessDays skips weekends, forwards and backwards", () => {
  assert.equal(addBusinessDays(FRI, 1).getDate(), 7); // Mon
  assert.equal(addBusinessDays(SAT, 1).getDate(), 7);
  assert.equal(
    addBusinessDays(SAT, 10).toDateString(),
    new Date(2026, 8, 18).toDateString(),
  );
  assert.equal(addBusinessDays(new Date(2026, 8, 7), -1).getDate(), 4); // Mon → Fri
  assert.equal(addBusinessDays(FRI, 0).getDate(), 4);
});

test("businessDaysBetween counts both ends, either order", () => {
  assert.equal(
    businessDaysBetween(new Date(2026, 2, 1), new Date(2026, 2, 31)),
    22,
  ); // March 2026
  assert.equal(
    businessDaysBetween(new Date(2026, 2, 31), new Date(2026, 2, 1)),
    22,
  );
  assert.equal(businessDaysBetween(SAT, SAT), 0);
  assert.equal(businessDaysBetween(FRI, FRI), 1);
  assert.equal(
    businessDaysBetween(new Date(2026, 0, 1), new Date(2026, 11, 31)),
    261,
  );
});

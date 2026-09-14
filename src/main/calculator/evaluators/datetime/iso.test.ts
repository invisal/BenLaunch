import assert from "node:assert/strict";
import { test } from "node:test";

import { parseIso, resolveIso } from "./iso.ts";

const NOW = new Date("2026-09-05T08:26:59Z");

test("parseIso: Zulu, offsets with/without a colon, and local", () => {
  assert.equal(
    parseIso("2024-03-15T14:30:00Z")?.toISOString(),
    "2024-03-15T14:30:00.000Z",
  );
  assert.equal(
    parseIso("2024-03-15T14:30:00z")?.toISOString(),
    "2024-03-15T14:30:00.000Z",
  );
  assert.equal(
    parseIso("2024-03-15T14:30:00+02:00")?.toISOString(),
    "2024-03-15T12:30:00.000Z",
  );
  assert.equal(
    parseIso("2024-03-15T14:30:00+0200")?.toISOString(),
    "2024-03-15T12:30:00.000Z",
  );
  assert.equal(
    parseIso("2024-03-15T14:30:00.250-05:00")?.toISOString(),
    "2024-03-15T19:30:00.250Z",
  );
  assert.equal(
    parseIso("2024-03-15 14:30")?.getTime(),
    new Date(2024, 2, 15, 14, 30).getTime(),
  );
  assert.equal(parseIso("2024-03-15"), null); // a bare date is weekday.ts's job
  assert.equal(parseIso("2024-13-45T99:99Z"), null);
});

test("a bare Zulu timestamp → local time with UTC / relative / weekday / epoch chips", () => {
  const calc = resolveIso("2026-09-05T08:14:59Z", NOW);
  assert.ok(calc);
  assert.equal(calc.rawValue, "2026-09-05T08:14:59.000Z");
  assert.deepEqual(calc.details, [
    { label: "UTC", value: "2026-09-05 08:14 UTC" },
    { label: "", value: "12 minutes ago" },
    { label: "Weekday", value: "Saturday" },
    { label: "Epoch", value: "1788596099" },
  ]);
});

test("an older timestamp reads in years and months", () => {
  const calc = resolveIso("2024-03-15T14:30:00Z", NOW);
  assert.equal(calc?.details?.[1].value, "2 years 5 months ago");
  assert.equal(calc?.details?.[2].value, "Friday");
  assert.equal(calc?.details?.[3].value, "1710513000");
});

test("a future timestamp reads 'in …'", () => {
  assert.equal(
    resolveIso("2026-09-08T08:26:59Z", NOW)?.details?.[1].value,
    "in 3 days",
  );
});

test("epoch seconds / milliseconds need a keyword", () => {
  for (const input of [
    "epoch 1700000000",
    "unix 1700000000000",
    "1700000000 unix",
    "timestamp 1700000000",
  ]) {
    assert.equal(
      resolveIso(input, NOW)?.rawValue,
      "2023-11-14T22:13:20.000Z",
      input,
    );
  }
  assert.equal(resolveIso("1700000000", NOW), null);
  assert.equal(resolveIso("epoch 12345", NOW), null);
});

test("now / a timestamp to epoch", () => {
  assert.deepEqual(resolveIso("now to unix", NOW), {
    expression: "now to unix",
    value: "1788596819",
    rawValue: "1788596819",
    details: [
      { label: "Milliseconds", value: "1788596819000" },
      { label: "UTC", value: "2026-09-05 08:26 UTC" },
    ],
  });
  assert.equal(
    resolveIso("2024-03-15T14:30:00Z to epoch", NOW)?.value,
    "1710513000",
  );
  assert.equal(resolveIso("tomorrow to epoch", NOW), null);
});

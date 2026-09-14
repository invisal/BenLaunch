import assert from "node:assert/strict";
import { test } from "node:test";

import { parseTimespanQuery } from "./parse.ts";

test("a bare span, a human target and arithmetic are all `span` queries", () => {
  assert.deepEqual(parseTimespanQuery("9000 seconds"), {
    kind: "span",
    seconds: 9000,
  });
  assert.deepEqual(parseTimespanQuery("145 mins to timespan"), {
    kind: "span",
    seconds: 8700,
  });
  assert.deepEqual(parseTimespanQuery("1h 30m + 45m"), {
    kind: "span",
    seconds: 8100,
  });
  assert.deepEqual(parseTimespanQuery("2h - 30m"), {
    kind: "span",
    seconds: 5400,
  });
  assert.deepEqual(parseTimespanQuery("20 min x 3"), {
    kind: "span",
    seconds: 3600,
  });
});

test("a time-unit target is a `convert` query", () => {
  assert.deepEqual(parseTimespanQuery("90 minutes in seconds"), {
    kind: "convert",
    seconds: 5400,
    unit: { name: "seconds", seconds: 1 },
  });
  assert.equal(parseTimespanQuery("2 hours to weeks")?.kind, "convert");
});

test("a lone `m` is metres only when it is the whole query", () => {
  assert.equal(parseTimespanQuery("10 m"), null);
  assert.deepEqual(parseTimespanQuery("10 m in seconds"), {
    kind: "convert",
    seconds: 600,
    unit: { name: "seconds", seconds: 1 },
  });
  assert.deepEqual(parseTimespanQuery("10 m + 5 m"), {
    kind: "span",
    seconds: 900,
  });
});

test("calendar units, unknown targets and junk are rejected", () => {
  assert.equal(parseTimespanQuery("2 months"), null);
  assert.equal(parseTimespanQuery("1 year in days"), null);
  assert.equal(parseTimespanQuery("1h to months"), null);
  assert.equal(parseTimespanQuery("1h to furlongs"), null);
  assert.equal(parseTimespanQuery("- 5 min"), null);
  assert.equal(parseTimespanQuery("5 min /0"), null);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { tryEvaluate } from "./evaluate.ts";

test("tryEvaluate: numeric results", () => {
  const r = tryEvaluate("2 + 3 * 4");
  assert.deepEqual(r, { kind: "number", value: 14 });
});

test("tryEvaluate: right-associative power", () => {
  assert.deepEqual(tryEvaluate("2 ^ 3 ^ 2"), { kind: "number", value: 512 });
});

test("tryEvaluate: unit results", () => {
  const r = tryEvaluate("10 cm in mm");
  assert.equal(r?.kind, "unit");
});

test("tryEvaluate: non-finite is rejected", () => {
  assert.equal(tryEvaluate("1 / 0"), null);
});

test("tryEvaluate: parse errors are swallowed", () => {
  for (const expr of ["(1 + 2", "1 +", "chrome + 2", ""]) {
    assert.equal(tryEvaluate(expr), null, expr);
  }
});

test("tryEvaluate: non-answer result types are rejected", () => {
  for (const expr of ["true", "2 > 1", "[1, 2, 3]"]) {
    assert.equal(tryEvaluate(expr), null, expr);
  }
});

test("tryEvaluate: meta-functions are not reachable", () => {
  assert.equal(tryEvaluate('import("fs")'), null);
  assert.equal(tryEvaluate('createUnit("foo")'), null);
});

test("log is base 10, ln is natural, log(x, b) keeps its base", () => {
  assert.deepEqual(tryEvaluate("log(1000)"), { kind: "number", value: 3 });
  assert.deepEqual(tryEvaluate("log(8, 2)"), { kind: "number", value: 3 });
  assert.deepEqual(tryEvaluate("ln(e)"), { kind: "number", value: 1 });
  // Functions built on the original log are unaffected.
  assert.equal(
    (tryEvaluate("log1p(1)") as { value: number }).value.toFixed(6),
    "0.693147",
  );
});

test("US kitchen units and data rates are defined", () => {
  const tsp = tryEvaluate("1 tsp to ml");
  assert.equal(tsp?.kind, "unit");
  assert.equal(tsp.value.toNumber("ml").toFixed(4), "4.9289");
  const tbsp = tryEvaluate("1 tablespoon to tsp");
  assert.equal(
    tbsp?.kind === "unit" && Math.round(tbsp.value.toNumber("tsp")),
    3,
  );
  const download = tryEvaluate("3 GB / 25 Mbps to s");
  assert.equal(download?.kind === "unit" && download.value.toNumber("s"), 960);
});

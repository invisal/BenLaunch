import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveConvert } from "./convert.ts";

const NOW = new Date("2026-06-15T12:00:00Z");
const UTC = "UTC";

test("5pm <src> in <dest>", () => {
  const calc = resolveConvert("5pm ldn in sf", NOW, UTC);
  assert.ok(calc);
  assert.equal(calc.value, "09:00 Mon");
  assert.equal(calc.rawValue, "09:00");
});

test("h:mm am/pm <src> to <dest>", () => {
  assert.equal(
    resolveConvert("9:30am NYC to Berlin", NOW, UTC)?.value,
    "15:30 Mon",
  );
});

test("noon <src> in <dest>", () => {
  assert.equal(
    resolveConvert("noon Tokyo in London", NOW, UTC)?.value,
    "04:00 Mon",
  );
});

test("midnight <src> in <dest> — date rollover", () => {
  assert.equal(
    resolveConvert("midnight UTC in LA", NOW, UTC)?.value,
    "17:00 Sun (prev day)",
  );
});

test("bare time with no source place defaults to localZone", () => {
  // localZone = UTC here, same as "midnight UTC in LA" above.
  assert.equal(
    resolveConvert("midnight in LA", NOW, UTC)?.value,
    "17:00 Sun (prev day)",
  );
});

test("a leading ISO date shows the destination's date", () => {
  assert.equal(
    resolveConvert("2026-03-15 14:00 UTC in Tokyo", NOW, UTC)?.value,
    "23:00 Sun, Mar 15",
  );
});

test("today / tomorrow / yesterday before or after the time", () => {
  assert.equal(
    resolveConvert("5pm tomorrow in tokyo", NOW, UTC)?.value,
    "02:00 Wed, Jun 17 (next day)",
  );
  assert.equal(
    resolveConvert("tomorrow 5pm ldn in sf", NOW, UTC)?.value,
    "09:00 Tue, Jun 16",
  );
  assert.equal(
    resolveConvert("5pm ldn tomorrow in sf", NOW, UTC)?.value,
    "09:00 Tue, Jun 16",
  );
  assert.equal(
    resolveConvert("yesterday midnight UTC in LA", NOW, UTC)?.value,
    "17:00 Sat, Jun 13 (prev day)",
  );
  assert.equal(
    resolveConvert("today noon Tokyo in London", NOW, UTC)?.value,
    "04:00 Mon, Jun 15",
  );
});

for (const input of [
  "", // empty
  "chrome", // no time token, no in/to
  "flight to paris", // no leading time token
  "5pm nowhere in sf", // unresolvable source place
  "5pm ldn in nowhere", // unresolvable destination place
  "5 in ft", // "ft" isn't a resolvable place (and too short for the fuzzy fallback)
  "25:00 ldn in sf", // invalid time
]) {
  test(`resolveConvert(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(resolveConvert(input, NOW, UTC), null);
  });
}

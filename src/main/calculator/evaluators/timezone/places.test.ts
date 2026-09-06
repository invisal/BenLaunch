import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveCountryZones, resolvePlace } from "./places.ts";

const NOW = new Date("2026-06-15T12:00:00Z");

test("resolves by exact name (case-insensitive)", () => {
  assert.equal(resolvePlace("Tokyo")?.timezone, "Asia/Tokyo");
  assert.equal(resolvePlace("tokyo")?.timezone, "Asia/Tokyo");
  assert.equal(resolvePlace("TOKYO")?.timezone, "Asia/Tokyo");
});

test("resolves a zone that only exists as a tzdb-historical name", () => {
  // The exact bug report this table exists to fix: Phnom Penh has no
  // "modern" zone of its own — Asia/Phnom_Penh is a pure alias of
  // Asia/Bangkok — but Intl still lists it as a valid, distinct identifier.
  assert.equal(resolvePlace("Phnom Penh")?.timezone, "Asia/Phnom_Penh");
});

test("resolves by alias/abbreviation", () => {
  assert.equal(resolvePlace("sf")?.timezone, "America/Los_Angeles");
  assert.equal(resolvePlace("nyc")?.timezone, "America/New_York");
  assert.equal(resolvePlace("ldn")?.timezone, "Europe/London");
  assert.equal(resolvePlace("jfk")?.timezone, "America/New_York");
  assert.equal(resolvePlace("blr")?.timezone, "Asia/Calcutta"); // Bengaluru shares Kolkata's zone
});

test("resolves multi-word city names", () => {
  assert.equal(resolvePlace("new york")?.timezone, "America/New_York");
  assert.equal(resolvePlace("los angeles")?.timezone, "America/Los_Angeles");
  assert.equal(resolvePlace("hong kong")?.timezone, "Asia/Hong_Kong");
});

test("is accent-insensitive", () => {
  assert.equal(resolvePlace("São Paulo")?.timezone, "America/Sao_Paulo");
  assert.equal(resolvePlace("sao paulo")?.timezone, "America/Sao_Paulo");
  assert.equal(resolvePlace("SÃO PAULO")?.timezone, "America/Sao_Paulo");
});

test("a zone renamed off its historical tzdb canonical name still answers to the old one too", () => {
  const kolkata = resolvePlace("Kolkata");
  assert.equal(kolkata?.timezone, "Asia/Calcutta");
  assert.equal(resolvePlace("Calcutta")?.timezone, kolkata?.timezone);
  assert.equal(
    resolvePlace("Ho Chi Minh City")?.timezone,
    resolvePlace("Saigon")?.timezone,
  );
  assert.equal(resolvePlace("Kyiv")?.timezone, resolvePlace("Kiev")?.timezone);
});

test("resolves by country name, when the country has one zone of its own", () => {
  assert.equal(resolvePlace("portugal")?.timezone, "Europe/Lisbon");
  assert.equal(resolvePlace("Portugal")?.timezone, "Europe/Lisbon");
  assert.equal(resolvePlace("japan")?.timezone, "Asia/Tokyo");
  // The bug report's country form.
  assert.equal(resolvePlace("cambodia")?.timezone, "Asia/Phnom_Penh");
});

test("a country whose only zone is a link to a neighbor still resolves to its own zone", () => {
  // Norway's, Sweden's, and Denmark's *canonical* zone (per the raw
  // country→zone data) is literally "Europe/Berlin" — they've always shared
  // Germany's offset/DST rules, so tzdb never bothered giving them their
  // own. But Europe/Oslo etc. are real, separately-listed zone ids that
  // *do* belong to Norway — resolving "time in norway" to "Frankfurt" would
  // be correct in offset but bizarre to read.
  assert.equal(resolvePlace("norway")?.timezone, "Europe/Oslo");
  assert.equal(resolvePlace("sweden")?.timezone, "Europe/Stockholm");
  assert.equal(resolvePlace("denmark")?.timezone, "Europe/Copenhagen");
});

test("a multi-zone country resolves to its capital", () => {
  // `resolvePlace` always answers with exactly one place — used by
  // `convert.ts`, which needs a single source/destination zone to do time
  // math with. `clock.ts`'s "current time" queries prefer the full listing
  // from `resolveCountryZones` below instead of this single answer.
  assert.equal(resolvePlace("united states")?.timezone, "America/New_York");
  assert.equal(resolvePlace("usa")?.timezone, "America/New_York");
  assert.equal(resolvePlace("canada")?.timezone, "America/Toronto");
  assert.equal(resolvePlace("australia")?.timezone, "Australia/Sydney");
  assert.equal(resolvePlace("malaysia")?.timezone, "Asia/Kuala_Lumpur");
});

test("a country with no sensible single default stays unresolved", () => {
  assert.equal(resolvePlace("antarctica"), null);
});

test("fuzzy fallback catches a partial/under-typed name", () => {
  // fuzzyMatch is subsequence-based (search-as-you-type tolerance, not full
  // spell-correction) — "tok" is a subsequence of both "tokyo" and
  // "stockholm", but Tokyo's consecutive-prefix match scores far higher.
  assert.equal(resolvePlace("tok")?.timezone, "Asia/Tokyo");
});

test("fuzzy:false disables the fallback, requiring an exact/alias match", () => {
  assert.equal(resolvePlace("tok", { fuzzy: false }), null);
  assert.equal(resolvePlace("tokyo", { fuzzy: false })?.timezone, "Asia/Tokyo");
});

for (const input of ["", "x", "chrome", "photoshop", "12345"]) {
  test(`resolvePlace(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(resolvePlace(input), null);
  });
}

// --- resolveCountryZones --------------------------------------------------

test("lists every distinct current offset a multi-zone country spans", () => {
  const us = resolveCountryZones("united states", NOW);
  assert.ok(us);
  assert.equal(us.country, "United States of America");
  // 29 raw zone ids collapse to the offsets actually in use right now, west
  // to east, each represented by the city people actually mean.
  assert.deepEqual(
    us.zones.map((z) => z.name),
    [
      "Honolulu",
      "Adak",
      "Anchorage",
      "Los Angeles",
      "Denver",
      "Chicago",
      "New York",
    ],
  );
});

test("prefers a well-known city when several zones share the current offset", () => {
  // Without that preference, whichever zone id sorts first alphabetically
  // within its offset group would win — "Adak"/"Boise"/"Detroit" instead of
  // "Anchorage"/"Denver"/"New York".
  const us = resolveCountryZones("united states", NOW);
  assert.ok(us?.zones.some((z) => z.name === "New York"));
  assert.equal(
    us?.zones.some((z) => z.name === "Detroit"),
    false,
  );
});

test("sorts the listing west to east (ascending UTC offset)", () => {
  const us = resolveCountryZones("united states", NOW);
  assert.ok(us);
  assert.equal(us.zones[0].name, "Honolulu"); // furthest behind UTC
  assert.equal(us.zones[us.zones.length - 1].name, "New York"); // furthest ahead
});

test("a country whose zones currently share one offset is not listed as multi-zone", () => {
  // Portugal *does* have 3 raw zone ids (mainland, Azores, Madeira), but
  // mainland Portugal and Madeira share an identical offset year-round —
  // only 2 are ever distinct, so this genuinely has something to list.
  const pt = resolveCountryZones("portugal", NOW);
  assert.ok(pt);
  assert.equal(pt.zones.length, 2);
});

test("a single-zone country has nothing to list", () => {
  assert.equal(resolveCountryZones("japan", NOW), null);
  assert.equal(resolveCountryZones("germany", NOW), null);
});

test("an unknown or non-country string has nothing to list", () => {
  assert.equal(resolveCountryZones("tokyo", NOW), null); // a city, not a country
  assert.equal(resolveCountryZones("chrome", NOW), null);
  assert.equal(resolveCountryZones("", NOW), null);
});

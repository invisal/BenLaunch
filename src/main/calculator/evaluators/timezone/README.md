# `timezone` evaluator

Current time in a place, and converting a specific time between places. Last
evaluator in the calculator pipeline ([../../index.ts](../../index.ts)) — by
the time it runs, `math`/`currency`/`datetime` have already claimed anything
they understood.

Input arrives already framed by the shared
[calculator/normalize.ts](../../normalize.ts) — the "what is …" lead-in and any
trailing `=` / `equals` / `?` are gone before this evaluator runs.

## How it works

```
input ─▶ cheap gate ─▶ convert ─▶ clock ─▶ Calculation
         ("time" or a   (5pm ldn   (time in
          time token)     in sf)    Tokyo)
```

| Module                   | Responsibility                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| [places.ts](places.ts)   | Generated city/country place table + `resolvePlace` (one place) and `resolveCountryZones` (every zone a multi-zone country spans) |
| [time.ts](time.ts)       | Minimal time-of-day parser: `5pm`, `9:30am`, `17:00`, `noon`, `midnight`                                                          |
| [clock.ts](clock.ts)     | "current time in a place"                                                                                                         |
| [convert.ts](convert.ts) | "convert a specific time" between places, via `date-fns-tz`                                                                       |
| [format.ts](format.ts)   | Shared offset/clock/weekday/calendar-date formatting                                                                              |
| [index.ts](index.ts)     | Wires the above into the `Evaluator`, tries `convert` (more specific) then `clock`                                                |

Unlike `math`/`currency`/`datetime`, this evaluator needs a proper
zoned-time library: turning "5pm in London" into an absolute instant requires
knowing London's DST rules for that particular day, which has no clean built-in
JS primitive. [`date-fns-tz`](https://github.com/marnusw/date-fns-tz) (MIT,
pure JS) provides `fromZonedTime` / `formatInTimeZone` for this.

## The place dataset ([places.ts](places.ts))

Almost entirely **generated from the runtime itself**, not a bundled dataset:

- **~418 cities** — one per zone in `Intl.supportedValuesOf('timeZone')`, the
  same canonical IANA identifier list `date-fns-tz`/`Intl.DateTimeFormat`
  already accept. IANA names each zone after "the largest city in the
  region," so `"America/New_York"` → `"New York"` for (almost) free — no
  dataset to bundle or keep in sync. This is also _why_ a city like Phnom Penh
  resolves at all: `Asia/Phnom_Penh` is a pure historical alias of
  `Asia/Bangkok` in modern tzdb, but the runtime still lists it as a distinct,
  valid identifier.
- **~248 countries**, via [`countries-and-timezones`](https://www.npmjs.com/package/countries-and-timezones)
  (MIT, zero dependencies) — specifically `getCountryForTimezone`, which
  attributes each zone id back to its own country. This is _not_ the same as
  that package's per-country zone list: a country whose own zone is a pure
  alias of a neighbor's (Norway's canonical zone is literally
  `Europe/Berlin`) never appears in that list under its own zone id, only the
  neighbor's — `getCountryForTimezone('Europe/Oslo')` still correctly says
  Norway, which is what lets `"time in norway"` answer "Oslo" instead of the
  much stranger "Frankfurt".
- A **small hand-written overlay** for what can't be derived: abbreviations
  and airport codes (`sf`, `nyc`, `ldn`, `jfk`, `blr`, …), cities that share a
  bigger city's zone and so have no id of their own (San Francisco → the same
  zone as Los Angeles; Beijing → Shanghai's), a handful of zones renamed to
  the spelling people actually type today (`Asia/Calcutta` displays as
  "Kolkata", with "Calcutta" kept as an alias), and — the one piece that
  can't be derived at all — a capital-city zone for the ~30 countries that
  really do span more than one zone of their own (see `CAPITAL_ZONE_OVERRIDES`
  in the source; United States → New York, Australia → Sydney, Portugal →
  Lisbon over the Azores, …). A country with no sensible single answer
  (Antarctica has no capital) is left unresolved on purpose.

`resolvePlace` is accent-insensitive ("São Paulo" and "sao paulo" hit the same
entry) and falls back to the app's own `fuzzyMatch`
([search.ts](../../../search.ts)) for a partially-typed name — but only for
inputs **3+ characters**. A 2-letter needle (`ft`, `in`, `kg`) is trivially a
subsequence of countless city names (`frankfurt` contains `f`…`t`) and would
otherwise turn ordinary unit abbreviations into bogus place matches; every
real alias this short (`sf`, `la`, `kl`) is already in the exact-match table,
so the cutoff costs nothing for legitimate input. Even at 3+ characters, a
haystack this size (~450 names once countries are included) throws up real
collisions — `usd` is a subsequence of "South Sudan", `mph` of "Thimphu" —
which is why [convert.ts](convert.ts) turns fuzzy matching off entirely for
its source/destination lookups (see its own comment); `clock.ts`'s `time in
<place>` shape keeps it on, since a bad guess there is softer failure (the
user already said "time in", so a fuzzy false-positive is still a clock
lookup, just possibly the wrong place) than hijacking an unrelated query.

## Supported use cases

### 1. Resolving a place ([places.ts](places.ts))

Every capability below works identically whether the place is typed into
`clock.ts`'s "current time" shapes or `convert.ts`'s "convert a time" shapes
(#2 and #3 below) — this is the shared engine behind both.

| Capability                                                                | Example query                                                      | Resolves to                                                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| A city with its own IANA zone (~418 of these, generated from the runtime) | `time in Tokyo`                                                    | `Asia/Tokyo`                                                                                                       |
| Abbreviation                                                              | `time in sf`                                                       | San Francisco (`America/Los_Angeles`)                                                                              |
| Airport code                                                              | `time in JFK`                                                      | New York                                                                                                           |
| Multi-word city name                                                      | `time in Hong Kong`, `time in New Delhi`                           | —                                                                                                                  |
| Accent-insensitive                                                        | `time in São Paulo` = `time in sao paulo`                          | `America/Sao_Paulo`                                                                                                |
| tzdb-historical name, either spelling works                               | `time in Kolkata` = `time in Calcutta`                             | `Asia/Calcutta`                                                                                                    |
| ditto                                                                     | `time in Kyiv` = `time in Kiev`                                    | `Europe/Kiev`                                                                                                      |
| ditto                                                                     | `time in Ho Chi Minh City` = `time in Saigon`                      | `Asia/Saigon`                                                                                                      |
| A city whose zone is a pure historical alias of another's                 | `time in Phnom Penh`                                               | `Asia/Phnom_Penh` (an alias of `Asia/Bangkok`, but still a distinct, resolvable identifier)                        |
| Partial/under-typed name (fuzzy, 3+ characters)                           | `time in tok`                                                      | Tokyo                                                                                                              |
| Country name, single-zone                                                 | `time in japan`, `time in cambodia`                                | Tokyo, Phnom Penh                                                                                                  |
| Country name aliases                                                      | `time in usa` / `us` / `america`; `uk` / `britain`; `korea`; `uae` | United States, United Kingdom, South Korea, United Arab Emirates                                                   |
| A country whose _canonical_ zone is a link to a neighbor                  | `time in norway`                                                   | Oslo's own zone, **not** the stranger-looking Frankfurt (Norway's raw canonical zone is literally `Europe/Berlin`) |
| A country spanning more than one zone of its own                          | `time in united states`, `time in russia`, `time in portugal`      | every currently-distinct zone (see #2)                                                                             |

Guardrails: the fuzzy fallback requires 3+ characters (a 2-letter needle like
`ft`/`kg` is a subsequence of countless city names) and `convert.ts` disables
it entirely for its source/destination lookups — full reasoning above.

### 2. Current time in a place — and time there ± an offset ([clock.ts](clock.ts))

| Query                       | Result          |
| --------------------------- | --------------- |
| `time in Tokyo`             | `21:00 · GMT+9` |
| `time at sf`                | `05:00 · GMT-7` |
| `what time is it in Berlin` | `14:00 · GMT+2` |
| `Tokyo time`                | `21:00 · GMT+9` |

The weekday is appended only when the target's calendar date differs from the
viewer's own — e.g. with a UTC viewer at noon Monday, `time in Auckland`
shows `00:00 Tue · GMT+12` (already the next day there).

**A relative offset** may be attached to the query, for the wall-clock time
in the place at a moment other than now — the offset can lead the place,
trail it, use an arithmetic `+`/`-` operator, or say `… ago`:

| Query                       | Result                                                        |
| --------------------------- | ------------------------------------------------------------- |
| `time in 6 hours in Tokyo`  | Tokyo's clock 6 hours from now (offset **leads** the place)   |
| `time in Tokyo in 6 hours`  | same — offset **trails** the place                            |
| `time in Tokyo + 6 hours`   | same — an arithmetic `+` / `-` operator                       |
| `time in Tokyo - 2h`        | 2 hours ago in Tokyo                                          |
| `time in Tokyo + 6`         | bare number after `+`/`-` ⇒ hours                             |
| `time in Tokyo 3 hours ago` | `18:00 · GMT+9` — trailing `… ago`                            |
| `time in 90 min in London`  | `14:30 · GMT+1`                                               |
| `time in 4 hours`           | `16:00` — **no place** ⇒ the viewer's own clock, no GMT label |
| `time in 20 hours`          | `08:00 Tue` — a midnight crossing appends the weekday         |

The offset grammar is deliberately small: `parseOffsetMs` / `splitOffset`
cover the prose forms (`<n> minutes|hours|days`, `min` / `hrs` / `a` / `an`,
trailing `… ago`); `splitArithmeticOffset` covers the `<place> ± <n> [unit]`
operator form (units `m`/`min`, `h`/`hr`, `d`/`day`, `w`/`week`; bare number ⇒
hours). Anything neither recognizes leaves the plain `time in <place>` path
untouched.

The trailing-`time` shape (`Tokyo time`) resolves the place by **exact/alias
match only** — no fuzzy fallback — since this phrasing is common enough in
ordinary text ("lunch time", "party time") that a fuzzy place match would risk
false positives.

**A multi-zone country lists every zone it currently spans**, instead of
picking one (see `resolveCountryZones` in [places.ts](places.ts)):

| Query                   | Result                                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `time in united states` | `Honolulu 02:00 · GMT-10  ·  Adak 03:00 · GMT-9  ·  Anchorage 04:00 · GMT-8  ·  Los Angeles 05:00 · GMT-7  ·  Denver 06:00 · GMT-6  ·  Chicago 07:00 · GMT-5  ·  New York 08:00 · GMT-4` |
| `time in portugal`      | `Azores 12:00 · GMT+0  ·  Madeira 13:00 · GMT+1` (mainland Portugal shares Madeira's offset)                                                                                             |
| `time in russia`        | 11 entries, Kaliningrad through Anadyr, each with its own `GMT±N`                                                                                                                        |
| `time in japan`         | `23:00 · GMT+9` — single-zone, so this is still the one-line form                                                                                                                        |

Offsets are computed **at query time** and de-duplicated by their _current_
value, not by raw zone id — the United States' 29 zone ids collapse to
whatever's actually distinct right now (usually 6-7; Arizona's Mountain time
without DST can coincide with Pacific time for part of the year and merge
into that entry). When several zones tie on one offset, the representative
shown is whichever is already flagged elsewhere in this file as well-known
(an `ALIASES` entry, or the target of an `EXTRA_PLACES` satellite city) —
`New York`/`Denver`/`Chicago`, not the alphabetically-first `Detroit`/
`Boise`/`Adak`-neighbor. A country whose zones happen to share one offset
today (rare, but structurally possible) falls through to the single-line
form via `resolvePlace`'s ordinary capital default.

This only applies to `clock.ts`'s "current time" queries. `convert.ts` (next)
always needs one concrete source zone to do time math with, so it keeps using
`resolvePlace`'s single capital-default answer for a country name.

**Rendering.** A multi-zone result also sets `Calculation.items` — one
`{ label: city, value: "HH:MM · GMT±N" }` per zone — alongside the flat
`value`/`rawValue` strings shown above.
[`CalculatorPanel.tsx`](../../../../renderer/src/screens/launcher/components/CalculatorPanel.tsx)
renders `items`, when present, as a single **horizontally-scrolling** row of
chips at a smaller size (splitting each `value` on `" · "` to show the offset
smaller/dimmer than the time) instead of either cramming every city into the
single-value line at its normal (much larger) size, or wrapping the panel
across several lines and pushing the rest of the results down the list;
`value`/`rawValue` exist purely for copy/paste and "use as input" and are
never displayed directly when `items` is set. Every other evaluator leaves
`items` unset and keeps the ordinary one-line display.

### 3. Convert a specific time ([convert.ts](convert.ts))

| Query                  | Result                 |
| ---------------------- | ---------------------- |
| `5pm ldn in sf`        | `09:00 Mon`            |
| `9:30am NYC to Berlin` | `15:30 Mon`            |
| `noon Tokyo in London` | `04:00 Mon`            |
| `midnight UTC in LA`   | `17:00 Sun (prev day)` |

The source is **today's date in the source zone** unless the query gives one;
a bare time with no source place (`midnight in LA`) defaults to the system's
own zone. `(next day)` / `(prev day)` is appended when the destination's
calendar date differs from the source's.

## Not claimed (returns `null` → next evaluator / action search)

| Query                             | Why                                                                                                                                                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chrome`, `5 + 3`                 | no "time" and no leading time-of-day token — rejected by the cheap gate                                                                                                                                           |
| `lunch time`, `party time`        | "lunch"/"party" don't resolve to a known place (and `<place> time` doesn't fuzzy-match)                                                                                                                           |
| `5 in ft`                         | "ft" isn't a resolvable place, and it's too short for the fuzzy fallback anyway                                                                                                                                   |
| `time in nowhere-at-all`          | not in the place table, and not a close enough fuzzy match                                                                                                                                                        |
| `10 usd to eur`, `100 mph in kmh` | claimed earlier by `currency`/`math` anyway, but also: `convert.ts` disables fuzzy matching for source/destination, so a 3-letter code never "resolves" to a place it merely happens to be a fuzzy subsequence of |
| `10 ft to m`, `35 days ago`       | claimed earlier by `math` / `datetime`; `timezone` never even sees them                                                                                                                                           |

## Testing note: the "local zone"

Both `resolveClock` and `resolveConvert` take an optional `localZone`
parameter (defaults to `Intl.DateTimeFormat().resolvedOptions().timeZone`,
i.e. the system's own) — it's the "viewer's day" the weekday-append rule
compares against, and the default source zone for a bare time with no source
place. Tests pass an explicit zone (`'UTC'`) so results don't depend on the
timezone of whatever machine runs them.

## Tests

Each module has a `*.test.ts`; [index.test.ts](index.test.ts) drives the
evaluator end-to-end with an injected clock and local zone
(`createTimezoneEvaluator(() => fixedDate, () => 'UTC')`, same pattern as
`currency`'s `createCurrencyEvaluator` / `datetime`'s
`createDatetimeEvaluator`). Full-pipeline cases (framing, chain fall-through)
live in [../../index.test.ts](../../index.test.ts).

```bash
node --test "src/main/calculator/**/*.test.ts"
```

# `timezone` evaluator — UAT

Manual acceptance test. Type each **Input**; check the **Result** on the right of
the panel. Last evaluator in the chain.

Results depend on the current instant and your machine's timezone. The **Result**
column is computed for a fixed baseline so it is checkable:

> **Reference "now": 2026-06-15 12:00 UTC · viewer's local zone = UTC.**
> (June ⇒ northern DST in effect: New York GMT-4, Berlin GMT+2, London GMT+1.)

Format: `21:00 · GMT+9`; a weekday (`03:00 Tue · GMT+9`) is appended only when the
target's day differs from yours; `(next day)` / `(prev day)` on converted times.
Every row is covered by a test under [`evaluators/timezone/`](.).

---

## 1. Current time in a place

| #   | Input                        | Result           | ✓   |
| --- | ---------------------------- | ---------------- | --- |
| 1.1 | `time in Tokyo`              | `21:00 · GMT+9`  |     |
| 1.2 | `time at sf`                 | `05:00 · GMT-7`  |     |
| 1.3 | `what time is it in Berlin`  | `14:00 · GMT+2`  |     |
| 1.4 | `what time in Berlin`        | `14:00 · GMT+2`  |     |
| 1.5 | `Tokyo time`                 | `21:00 · GMT+9` (exact/alias only — `Tokyoo time` ⇒ nothing) |  |

## 2. Place resolution

| #   | Input form                     | Resolves to            | ✓   |
| --- | ------------------------------ | ---------------------- | --- |
| 2.1 | exact city — `Tokyo` / `tokyo` / `TOKYO` | Asia/Tokyo   |     |
| 2.2 | alias — `sf`, `nyc`, `ldn`, `jfk`, `blr` | LA / NYC / London / NYC / Kolkata |  |
| 2.3 | multi-word — `new york`, `hong kong`, `los angeles` | resolves |  |
| 2.4 | accents optional — `São Paulo` / `sao paulo` | America/Sao_Paulo |  |
| 2.5 | historical name — `Calcutta`, `Saigon`, `Kiev` | same zone as Kolkata / Ho Chi Minh City / Kyiv |  |
| 2.6 | single-zone country — `time in germany` | `14:00 · GMT+2` (canonicalizes to `time in Berlin`) |  |
| 2.7 | under-typed — `tok` | Asia/Tokyo (fuzzy fallback) |  |

## 3. Multi-zone country → lists every zone it currently spans

| #   | Input                   | Result | ✓   |
| --- | ----------------------- | ------ | --- |
| 3.1 | `time in united states` | `Honolulu 02:00 · GMT-10  ·  Adak 03:00 · GMT-9  ·  Anchorage 04:00 · GMT-8  ·  Los Angeles 05:00 · GMT-7  ·  Denver 06:00 · GMT-6  ·  Chicago 07:00 · GMT-5  ·  New York 08:00 · GMT-4` |  |
| 3.2 | `united states time`    | same as 3.1 |  |

West-to-east, one city per distinct current offset, rendered as chips in the
panel.

## 4. Current time + a relative offset (either side of the place)

| #   | Input                        | Result               | ✓   |
| --- | ---------------------------- | -------------------- | --- |
| 4.1 | `time in 6 hours in Tokyo`   | `03:00 Tue · GMT+9`  |     |
| 4.2 | `time in Tokyo in 6 hours`   | `03:00 Tue · GMT+9`  |     |
| 4.3 | `time in 90 min in London`   | `14:30 · GMT+1`      |     |
| 4.4 | `time in an hour in Berlin`  | `15:00 · GMT+2`      |     |
| 4.5 | `time in Tokyo 3 hours ago`  | `18:00 · GMT+9`      |     |

## 5. Current time + an arithmetic offset on the place

Bare number ⇒ hours.

| #   | Input                     | Result              | ✓   |
| --- | ------------------------- | ------------------- | --- |
| 5.1 | `time in Tokyo + 6 hours` | `03:00 Tue · GMT+9` |     |
| 5.2 | `time in Tokyo + 6`       | `03:00 Tue · GMT+9` |     |
| 5.3 | `time in Tokyo - 2h`      | `19:00 · GMT+9`     |     |
| 5.4 | `time in London + 90 min` | `14:30 · GMT+1`     |     |

## 6. "time in N hours" — no place ⇒ your own clock

No GMT label (it's local); weekday appended if it rolls past midnight.

| #   | Input               | Result       | ✓   |
| --- | ------------------- | ------------ | --- |
| 6.1 | `time in 4 hours`   | `16:00`      |     |
| 6.2 | `time in 20 hours`  | `08:00 Tue`  |     |
| 6.3 | `time in 5 in Tokyo`| _nothing — bare `5` isn't a recognised offset_ |  |

## 7. Convert a specific time between places

`<time> <source> in|to <dest>`. Source place optional — defaults to your zone.

| #   | Input                    | Result                    | ✓   |
| --- | ------------------------ | ------------------------- | --- |
| 7.1 | `5pm ldn in sf`          | `09:00 Mon`               |     |
| 7.2 | `9:30am NYC to Berlin`   | `15:30 Mon`               |     |
| 7.3 | `noon Tokyo in London`   | `04:00 Mon`               |     |
| 7.4 | `midnight UTC in LA`     | `17:00 Sun (prev day)`    |     |
| 7.5 | `midnight in LA`         | `17:00 Sun (prev day)` (no source ⇒ your zone) |  |

Time tokens accepted: `5pm`, `5PM`, `5am`, `12pm`, `12am`, `9:30am`, `17:00`,
`0:00`, `noon`, `midnight`. Rejected: `13pm`, `0pm`, `25:00`, `5:70`.

## 8. Not claimed — nothing shown, query falls through

| #   | Input                       | Why                              | ✓   |
| --- | --------------------------- | -------------------------------- | --- |
| 8.1 | `` (empty)                  | nothing to parse                 |     |
| 8.2 | `chrome`, `photoshop`       | no time token, no place          |     |
| 8.3 | `5 + 3`, `10 usd to eur`, `35 days ago` | claimed earlier in the chain |  |
| 8.4 | `lunch time`, `party time`  | `time` but no resolvable place   |     |
| 8.5 | `time in nowhere-at-all`    | unresolvable place               |     |
| 8.6 | `5pm nowhere in sf`, `5pm ldn in nowhere` | unresolvable source / destination |  |
| 8.7 | `time in heard island and mcdonald islands` | country with zero zones of its own |  |

---

```bash
node --test "src/main/calculator/evaluators/timezone/**/*.test.ts"
```

# `datetime` evaluator — UAT

Manual acceptance test. Type each **Input**; check the **Result** on the right of
the panel.

Results depend on the current date/time. The **Result** column is computed for a
fixed reference instant so it is checkable:

> **Reference "now": Saturday 5 September 2026, 10:00 (local).**

Running live, the absolute dates differ but the relationships (offsets, weekdays,
durations) hold. House format: `Mon, Aug 10` for dates, `8:45 PM` for clock
times, `9 hours 45 minutes` for durations. Every row is covered by a test under
[`evaluators/datetime/`](.).

---

## 1. Relative dates

| #   | Input               | Result                                      | ✓   |
| --- | ------------------- | ------------------------------------------- | --- |
| 1.1 | `tomorrow`          | `Sun, Sep 6`                                |     |
| 1.2 | `35 days ago`       | `Sat, Aug 1`                                |     |
| 1.3 | `monday in 3 weeks` | `Sat, Sep 26`                               |     |
| 1.4 | `2 weeks from now`  | `Sat, Sep 19`                               |     |
| 1.5 | `next friday`       | `Fri, Sep 11`                               |     |
| 1.6 | `last friday`       | `Fri, Sep 4` (never pushed into the future) |     |

## 2. Phrases carrying a time-of-day → shown to the minute

Not collapsed to a bare calendar day.

| #   | Input                 | Result                 | ✓   |
| --- | --------------------- | ---------------------- | --- |
| 2.1 | `now + 90 min`        | `Sat, Sep 5, 11:30 AM` |     |
| 2.2 | `in 3 hours`          | `Sat, Sep 5, 1:00 PM`  |     |
| 2.3 | `90 minutes from now` | `Sat, Sep 5, 11:30 AM` |     |
| 2.4 | `tomorrow at 5pm`     | `Sun, Sep 6, 5:00 PM`  |     |

## 3. Business days

Hand-rolled (step day-by-day, skip Sat/Sun) — `chrono` has no concept of these.

| #   | Input                 | Result        | ✓   |
| --- | --------------------- | ------------- | --- |
| 3.1 | `in 10 business days` | `Fri, Sep 18` |     |

## 4. Ordinal period boundaries

| #   | Input                        | Result             | ✓   |
| --- | ---------------------------- | ------------------ | --- |
| 4.1 | `first day of next month`    | `Thu, Oct 1`       |     |
| 4.2 | `last day of this month`     | `Wed, Sep 30`      |     |
| 4.3 | `first day of the year`      | `Thu, Jan 1`       |     |
| 4.4 | `first day of 2029`          | `Mon, Jan 1, 2029` |     |
| 4.5 | `last day of 2029`           | `Mon, Dec 31, 2029`|     |
| 4.6 | `last day of february 2028`  | `Tue, Feb 29, 2028` (leap year) |  |

## 5. Date / time arithmetic — `<date-or-time> ± <n> [unit]`

A bare number takes its unit from the left side: **days** after a date, **hours**
after a clock time. Month/year math is calendar-correct.

| #    | Input                  | Result                                  | ✓   |
| ---- | ---------------------- | --------------------------------------- | --- |
| 5.1  | `August 5 + 5`         | `Mon, Aug 10`                           |     |
| 5.2  | `August 5 - 3`         | `Sun, Aug 2`                            |     |
| 5.3  | `August 5 plus 5`      | `Mon, Aug 10`                           |     |
| 5.4  | `August 5 minus 3`     | `Sun, Aug 2`                            |     |
| 5.5  | `2026-01-15 + 3 weeks` | `Thu, Feb 5`                            |     |
| 5.6  | `2026-01-15 + 2w`      | `Thu, Jan 29`                           |     |
| 5.7  | `today - 10 days`      | `Wed, Aug 26`                           |     |
| 5.8  | `2026-01-31 + 1 month` | `Sat, Feb 28` (clamps to last day)      |     |
| 5.9  | `2026-01-15 + 1 year`  | `Fri, Jan 15, 2027`                     |     |
| 5.10 | `3:45pm + 5`           | `8:45 PM` (stays a clock time)          |     |
| 5.11 | `3:45pm - 2`           | `1:45 PM`                               |     |
| 5.12 | `9:00 + 90 min`        | `10:30 AM`                              |     |
| 5.13 | `9:00 + 8h`            | `5:00 PM`                               |     |
| 5.14 | `now + 90 min`         | `Sat, Sep 5, 11:30 AM` (keeps the date) |     |

## 6. Clock-time arithmetic crossing midnight

| #   | Input       | Result                | ✓   |
| --- | ----------- | --------------------- | --- |
| 6.1 | `11pm + 3h` | `2:00 AM (next day)`  |     |
| 6.2 | `1am - 2h`  | `11:00 PM (prev day)` |     |

## 7. Countdowns

| #   | Input                      | Result                          | ✓   |
| --- | -------------------------- | ------------------------------- | --- |
| 7.1 | `days until 25 Dec`        | `111 days`                      |     |
| 7.2 | `weeks until 2026-12-01`   | `12 weeks`                      |     |
| 7.3 | `days left in the month`   | `26 days`                       |     |
| 7.4 | `days left in the quarter` | `26 days` (Q3 ends 30 Sep)      |     |
| 7.5 | `days left in the year`    | `118 days`                      |     |
| 7.6 | `days until 1 Jan 2020`    | _nothing — target already past_ |     |

## 8. Date differences

| #   | Input                                    | Result                                      | ✓   |
| --- | ---------------------------------------- | ------------------------------------------- | --- |
| 8.1 | `days between 1 Jan and 1 Apr`           | `90 days`                                   |     |
| 8.2 | `between 1 Jan and 1 Apr`                | `13 weeks` (no unit ⇒ auto-picks)           |     |
| 8.3 | `days between 1 Jan and 15 Mar`          | `73 days` (both chained to the same season) |     |
| 8.4 | `days between 2024-01-15 and 2024-06-30` | `167 days`                                  |     |
| 8.5 | `1990-05-01 to today`                    | `436 months`                                |     |
| 8.6 | `1988-12-08 to today in days`            | `13785 days` (trailing `in <unit>` forces the unit) |  |
| 8.7 | `1988-12-08 to today in weeks`           | `1969 weeks`                                |     |

## 9. Sub-day differences — shown to the minute, never rounded to "1 day"

| #   | Input               | Result                                              | ✓   |
| --- | ------------------- | --------------------------------------------------- | --- |
| 9.1 | `now until 9AM`     | `23 hours` (9AM already passed ⇒ rolls to tomorrow) |     |
| 9.2 | `now until 10:30AM` | `30 minutes`                                        |     |
| 9.3 | `now to 6PM`        | `8 hours`                                           |     |

## 10. Weekday of a date — "what day does it fall on?"

Answers with the spelled-out weekday plus the resolved date; `rawValue` is the
bare weekday. A bare ISO date resolves the same way (house date format, which
already carries the weekday).

| #    | Input                               | Result              | ✓   |
| ---- | ----------------------------------- | ------------------- | --- |
| 10.1 | `day of 2026-12-25`                 | `Friday, Dec 25`    |     |
| 10.2 | `weekday of 2026-12-25`             | `Friday, Dec 25`    |     |
| 10.3 | `what day is 2026-12-25`            | `Friday, Dec 25`    |     |
| 10.4 | `what day of the week is 2026-12-25`| `Friday, Dec 25`    |     |
| 10.5 | `what day is 25 Dec 2026`           | `Friday, Dec 25`    |     |
| 10.6 | `2026-12-25 what day`               | `Friday, Dec 25`    |     |
| 10.7 | `what day is 1 Jan 2029`            | `Monday, Jan 1, 2029` |   |
| 10.8 | `what day is tomorrow`              | `Sunday, Sep 6`     |     |
| 10.9 | `2026-12-25` (bare)                 | `Fri, Dec 25`       |     |

## 11. Not claimed — nothing shown, query falls through

| #    | Input                                           | Why                                                 | ✓   |
| ---- | ----------------------------------------------- | --------------------------------------------------- | --- |
| 11.1 | `` (empty)                                      | nothing to parse                                    |     |
| 11.2 | `chrome`, `photoshop`                           | no date-ish token                                   |     |
| 11.3 | `5 + 3`, `2 + 2`                                | plain math                                          |     |
| 11.4 | `10 usd to eur`                                 | currency, claimed earlier in the chain              |     |
| 11.5 | `5 in ft`                                       | unit conversion                                     |     |
| 11.6 | `today's news`, `monday.com`                    | a date word inside another string — must not hijack |     |
| 11.7 | `call at 5pm`, `1:1 meeting`, `august occasion` | a time/month word but no `±` operator or operand    |     |
| 11.8 | `flight to paris`, `message to bob`             | `to` but neither side is a date                     |     |
| 11.9 | `what day is the meeting`, `day of chrome`      | the weekday phrasing, but the date part won't parse |     |

---

```bash
node --test "src/main/calculator/evaluators/datetime/**/*.test.ts"
```

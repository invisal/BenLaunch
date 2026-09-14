# `timespan` evaluator — UAT

Durations as people say them (pere-doc #16). Spans are shown exactly — every
non-zero unit down to the second, never rounded to the two biggest. Extra
chips: the **Total** in the biggest unit the span fills, and the **Clock** form.

First in the pipeline (see [../../index.ts](../../index.ts)). A lone `10 m`
means metres (→ `math` auto-conversion); months/years aren't fixed lengths
(→ `datetime`).

## 1. Break a duration down

| #    | Input                              | Result                                | Chips                    | ✓   |
| ---- | ---------------------------------- | ------------------------------------- | ------------------------ | --- |
| 1.1  | `145 mins to timespan`             | `2 hours 25 minutes`                  | `2.417 hours`, `2:25:00` |     |
| 1.2  | `9000 seconds`                     | `2 hours 30 minutes`                  | `2.5 hours`, `2:30:00`   |     |
| 1.3  | `9000 seconds as timespan`         | `2 hours 30 minutes`                  |                          |     |
| 1.4  | `100000 s in human readable`       | `1 day 3 hours 46 minutes 40 seconds` |                          |     |
| 1.5  | `5400 sec to duration`             | `1 hour 30 minutes`                   |                          |     |
| 1.6  | `2 weeks`                          | `14 days`                             | `336 hours`, `336:00:00` |     |
| 1.7  | `90 min`                           | `1 hour 30 minutes`                   | `1.5 hours`, `1:30:00`   |     |
| 1.8  | `45 seconds`                       | `45 seconds`                          | `0:00:45`                |     |
| 1.9  | `2.5 days`                         | `2 days 12 hours`                     |                          |     |
| 1.10 | `1h 30m` / `1 hour and 30 minutes` | `1 hour 30 minutes`                   |                          |     |

## 2. Arithmetic on durations

| #   | Input                      | Result               | ✓   |
| --- | -------------------------- | -------------------- | --- |
| 2.1 | `1h 30m + 45m`             | `2 hours 15 minutes` |     |
| 2.2 | `3600s + 45m`              | `1 hour 45 minutes`  |     |
| 2.3 | `2h - 15 min`              | `1 hour 45 minutes`  |     |
| 2.4 | `1h - 3h`                  | `-2 hours`           |     |
| 2.5 | `1h 30m * 2`               | `3 hours`            |     |
| 2.6 | `3h / 4`                   | `45 minutes`         |     |
| 2.7 | `10 min + 20 min + 30 min` | `1 hour`             |     |

## 3. A duration as a total in one unit

| #   | Input                   | Result          | ✓   |
| --- | ----------------------- | --------------- | --- |
| 3.1 | `90 minutes in seconds` | `5,400 seconds` |     |
| 3.2 | `2.5 days in hours`     | `60 hours`      |     |
| 3.3 | `145 min to hours`      | `2.417 hours`   |     |
| 3.4 | `60 s in minutes`       | `1 minute`      |     |
| 3.5 | `1h 30m in minutes`     | `90 minutes`    |     |
| 3.6 | `3 weeks in days`       | `21 days`       |     |
| 3.7 | `1500 ms to seconds`    | `1.5 seconds`   |     |

## 4. Not claimed

| #   | Input                                          | Goes to / why                   | ✓   |
| --- | ---------------------------------------------- | ------------------------------- | --- |
| 4.1 | `10 m`, `45m`                                  | metres → `math` auto-conversion |     |
| 4.2 | `2 months`, `3 years`, `1h to months`          | calendar lengths → `datetime`   |     |
| 4.3 | `in 3 days`, `35 days ago`, `2 weeks from now` | relative dates → `datetime`     |     |
| 4.4 | `3:45pm + 90 min`, `now + 90 min`              | clock arithmetic → `datetime`   |     |
| 4.5 | `10 hours in tokyo`, `time in 4 hours`         | → `timezone`                    |     |
| 4.6 | `2 apples`, `3h / 0`, `55h in workdays`        | not a span                      |     |

```bash
node --test "src/main/calculator/evaluators/timespan/*.test.ts" "src/main/calculator/common/*.test.ts"
```

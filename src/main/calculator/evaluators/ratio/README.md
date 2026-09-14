# `ratio` evaluator — UAT

How two numbers relate (pere-doc #22): simplified ratio, decimal, percent, and
the common aspect-ratio name when there is one. Runs before `math`.

## 1. Relate two numbers

| #    | Input                                                    | Result                      | Chips                                                        | ✓   |
| ---- | -------------------------------------------------------- | --------------------------- | ------------------------------------------------------------ | --- |
| 1.1  | `ratio of 3 to 5`                                        | `3 : 5`                     | Decimal `0.6`, Percent `60%`                                 |     |
| 1.2  | `ratio of 1920 to 1080`                                  | `16 : 9`                    | Decimal `1.778`, Percent `177.78%`, Aspect `16:9 Widescreen` |     |
| 1.3  | `ratio of 2 to 8`                                        | `1 : 4`                     | Decimal `0.25`, Percent `25%`                                |     |
| 1.4  | `ratio of 4 to 6`                                        | `2 : 3`                     | Decimal `0.6667`, Percent `66.67%`                           |     |
| 1.5  | `ratio between 10 and 20` / `ratio 3/5` / `3 to 5 ratio` | `1 : 2` / `3 : 5` / `3 : 5` |                                                              |     |
| 1.6  | `1920:1080` / `16:9`                                     | `16 : 9`                    | … Aspect `16:9 Widescreen`                                   |     |
| 1.7  | `16 : 10`                                                | `8 : 5`                     | … Aspect `16:10 Widescreen`                                  |     |
| 1.8  | `1366:768`                                               | `683 : 384`                 | … Aspect `≈ 16:9 Widescreen`                                 |     |
| 1.9  | `1080:1920`                                              | `9 : 16`                    | … Aspect `9:16 Vertical`                                     |     |
| 1.10 | `ratio of 1.5 to 1`                                      | `3 : 2`                     | … Aspect `3:2 Classic 35mm`                                  |     |
| 1.11 | `ratio 10:30`                                            | `1 : 3`                     | (the `ratio` keyword overrides the clock-time reading)       |     |

## 2. Scale & solve

| #   | Input                      | Result          | Chips                       | ✓   |
| --- | -------------------------- | --------------- | --------------------------- | --- |
| 2.1 | `16:9 to 1280`             | `1280 : 720`    | Ratio `16 : 9`              |     |
| 2.2 | `16:9 with height 1080`    | `1920 : 1080`   | Ratio `16 : 9`              |     |
| 2.3 | `1920:1080 scaled to 1280` | `1280 : 720`    | Ratio `16 : 9`              |     |
| 2.4 | `16:9 to 1366`             | `1366 : 768.38` | Ratio `16 : 9`              |     |
| 2.5 | `3:5 = 9:x`                | `15`            | Proportion `3 : 5 = 9 : 15` |     |
| 2.6 | `3:5 = x:15`               | `9`             | Proportion `3 : 5 = 9 : 15` |     |

## 3. Not claimed

| #   | Input                                                       | Why                       | ✓   |
| --- | ----------------------------------------------------------- | ------------------------- | --- |
| 3.1 | `10:30`, `9:45`, `23:59`                                    | clock times → `datetime`  |     |
| 3.2 | `3/5`                                                       | division → `math` (`0.6`) |     |
| 3.3 | `ratio`, `0:0`, `0:9 to 1280`, `ratio of apples to oranges` | nothing to relate         |     |

```bash
node --test "src/main/calculator/evaluators/ratio/*.test.ts"
```

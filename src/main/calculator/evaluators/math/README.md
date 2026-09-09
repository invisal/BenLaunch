# `math` evaluator — UAT

Manual acceptance test. Type each **Input** into the launcher; the panel shows a
parsed expression (**Shown as**, when it differs from what you typed) on the left
and the **Result** on the right. Tick **✓** when it matches.

Framing — a `what is` / `what's` / `calculate` / `compute` / `convert` lead-in and
a trailing `=` / `equals` / `?` — is stripped before this evaluator runs, so
`what is 7 * 6 =` behaves exactly like `7 * 6`.

Every case below is covered by a test under
[`evaluators/math/`](.) or [`calculator/index.test.ts`](../../index.test.ts).

---

## 1. Plain arithmetic

Precedence, parentheses, negatives, decimals, big-number grouping.

| #    | Input         | Result      | ✓   |
| ---- | ------------- | ----------- | --- |
| 1.1  | `60 + 74`     | `134`       |     |
| 1.2  | `1 + 2`       | `3`         |     |
| 1.3  | `2+3*4`       | `14`        |     |
| 1.4  | `2*3+4`       | `10`        |     |
| 1.5  | `(3 + 4) * 2` | `14`        |     |
| 1.6  | `10 / 4`      | `2.5`       |     |
| 1.7  | `-5 + 8`      | `3`         |     |
| 1.8  | `7 - 9`       | `-2`        |     |
| 1.9  | `2 ^ 10`      | `1,024`     |     |
| 1.10 | `2 ^ 3 ^ 2`   | `512` (right-associative) |     |
| 1.11 | `10 % 3`      | `1`         |     |
| 1.12 | `0.1 + 0.2`   | `0.3` (float noise trimmed) |     |
| 1.13 | `1000000 * 2` | `2,000,000` |     |
| 1.14 | `3!`          | `6`         |     |

## 2. Spoken operators

Rewritten only when the word sits between two operands (so `sunny plus warm`
stays non-math). Case-insensitive; chainable.

| #    | Input                 | Shown as      | Result | ✓   |
| ---- | --------------------- | ------------- | ------ | --- |
| 2.1  | `5 plus 3`            | `5 + 3`       | `8`    |     |
| 2.2  | `10 minus 4`          | `10 - 4`      | `6`    |     |
| 2.3  | `6 times 7`           | `6 * 7`       | `42`   |     |
| 2.4  | `8 multiplied by 9`   | `8 * 9`       | `72`   |     |
| 2.5  | `100 divided by 4`    | `100 / 4`     | `25`   |     |
| 2.6  | `17 mod 5`            | `17 % 5`      | `2`    |     |
| 2.7  | `17 modulo 5`         | `17 % 5`      | `2`    |     |
| 2.8  | `2 to the power of 8` | `2 ^ 8`       | `256`  |     |
| 2.9  | `2 power 8`           | `2 ^ 8`       | `256`  |     |
| 2.10 | `5 PLUS 3`            | `5 + 3`       | `8`    |     |
| 2.11 | `1 plus 2 plus 3`     | `1 + 2 + 3`   | `6`    |     |

## 3. Symbol variants

| #   | Input               | Shown as   | Result                   | ✓   |
| --- | ------------------- | ---------- | ------------------------ | --- |
| 3.1 | `12 × 3`            | `12 * 3`   | `36`                     |     |
| 3.2 | `100 ÷ 4`           | `100 / 4`  | `25`                     |     |
| 3.3 | `8 − 5` (U+2212, or en/em dash) | `8 - 5` | `3`         |     |
| 3.4 | `2π`               | `2 pi`     | _bare value — nothing shown, see §10_ |     |

## 4. "x" as multiply

Only wedged between two numbers — the `x` in `max(2, 3)` is left alone.

| #   | Input        | Shown as  | Result | ✓   |
| --- | ------------ | --------- | ------ | --- |
| 4.1 | `3 x 4`      | `3 * 4`   | `12`   |     |
| 4.2 | `3x4`        | `3 * 4`   | `12`   |     |
| 4.3 | `max(2, 3)`  | `max(2, 3)`| `3`   |     |

## 5. Question phrasing & trailing punctuation

Stripped upstream by [calculator/normalize.ts](../../normalize.ts); listed here
because it is part of the same "type it how you'd say it" experience.

| #   | Input                           | Shown as    | Result | ✓   |
| --- | ------------------------------- | ----------- | ------ | --- |
| 5.1 | `what is 7 * 6`                 | `7 * 6`     | `42`   |     |
| 5.2 | `what's 7 * 6`                  | `7 * 6`     | `42`   |     |
| 5.3 | `calculate 100 / 4`            | `100 / 4`   | `25`   |     |
| 5.4 | `9 + 10 =`                      | `9 + 10`    | `19`   |     |
| 5.5 | `5 * 5 equals`                  | `5 * 5`     | `25`   |     |
| 5.6 | `2 + 2?`                        | `2 + 2`     | `4`    |     |
| 5.7 | `what is 6 times 7`            | `6 * 7`     | `42`   |     |
| 5.8 | `what is 7 * 6 =`              | `7 * 6`     | `42`   |     |

## 6. Functions & constants

Anything the bare `mathjs` grammar understands, plus spoken forms rewritten in
[normalize.ts](normalize.ts).

| #    | Input                    | Shown as       | Result           | ✓   |
| ---- | ------------------------ | -------------- | ---------------- | --- |
| 6.1  | `sqrt(144)`              | —              | `12`             |     |
| 6.2  | `sin(30 deg)`            | —              | `0.5`            |     |
| 6.3  | `log(1000, 10)`          | —              | `3`              |     |
| 6.4  | `2 * pi`                 | —              | `6.28318530718`  |     |
| 6.5  | `square root of 625`     | `sqrt(625)`    | `25`             |     |
| 6.6  | `sqrt of 16`             | `sqrt(16)`     | `4`              |     |
| 6.7  | `the square root of 2`   | `sqrt(2)`      | `1.41421356237`  |     |
| 6.8  | `square root of 1,000`   | `sqrt(1000)`   | `31.6227766017`  |     |
| 6.9  | `√625`                   | `sqrt(625)`    | `25`             |     |
| 6.10 | `√(16 + 9)`              | `sqrt(16 + 9)` | `5`              |     |
| 6.11 | `square root of 16 + 9`  | `sqrt(16) + 9` | `13`             |     |
| 6.12 | `cube root of 27`        | `cbrt(27)`     | `3`              |     |
| 6.13 | `factorial of 5`         | `factorial(5)` | `120`            |     |
| 6.14 | `5 squared` / `5 square` | `(5)^2`        | `25`             |     |
| 6.15 | `2 cubed` / `2 cube`     | `(2)^3`        | `8`              |     |
| 6.16 | `(2 + 3) squared`        | `(2 + 3)^2`    | `25`             |     |
| 6.17 | `pi squared`             | `(pi)^2`       | `9.86960440109`  |     |
| 6.18 | `5 squared plus 1`       | `(5)^2 + 1`    | `26`             |     |

## 7. Unit-aware math

`mathjs` keeps units through the operation and converts on `in` / `to`. Most word
forms already work; [units.ts](units.ts) covers the gaps (bare `C`/`F`,
`in`-as-connector, a few aliases).

| #    | Input                | Shown as              | Result             | ✓   |
| ---- | -------------------- | --------------------- | ------------------ | --- |
| 7.1  | `128 GB to MB`       | —                     | `128000 MB`        |     |
| 7.2  | `10 cm in mm`        | `10 cm to mm`         | `100 mm`           |     |
| 7.3  | `20 degC to degF`    | —                     | `68 degF`          |     |
| 7.4  | `1 kg + 2 g`         | —                     | `1.002 kg`         |     |
| 7.5  | `5 m in ft`          | `5 m to ft`           | `16.404199 ft`     |     |
| 7.6  | `29 inches to cm`    | —                     | `73.66 cm`         |     |
| 7.7  | `10 ft in m`         | `10 ft to m`          | `3.048 m`          |     |
| 7.8  | `23C to F`           | `23 degC to degF`     | `73.4 degF`        |     |
| 7.9  | `0F to C`            | `0 degF to degC`      | `-17.777778 degC`  |     |
| 7.10 | `180 pounds to kg`   | `180 lbs to kg`       | `81.646627 kg`     |     |
| 7.11 | `180 lbs in kg`      | `180 lbs to kg`       | `81.646627 kg`     |     |
| 7.12 | `2 tbsp in ml`       | `2 tablespoon to ml`  | `30 ml`            |     |
| 7.13 | `2 tsp in ml`        | `2 teaspoon to ml`    | `10 ml`            |     |
| 7.14 | `100 kmh in mph`     | `100 km/h to mi/h`    | `62.137119 mi / h` |     |
| 7.15 | `100 kph in mph`     | `100 km/h to mi/h`    | `62.137119 mi / h` |     |
| 7.16 | `5 in`              | —                      | `5 in` — bare `in` at end stays the inch unit, not the connector |     |
| 7.17 | `5 in ft`           | `5 to ft`              | _nothing — no source unit to convert from_ |     |

## 8. Percentages

Trailing `%` gets "of the other operand" semantics natively; [percent.ts](percent.ts)
adds `X% of Y` and answers "what percent" phrasing directly.

| #   | Input                          | Shown as    | Result | ✓   |
| --- | ------------------------------ | ----------- | ------ | --- |
| 8.1 | `850 + 8.25%`                  | —           | `920.125` |  |
| 8.2 | `250 - 10%`                    | —           | `225`  |     |
| 8.3 | `47%`                          | —           | `0.47` (a bare ratio) |  |
| 8.4 | `1000 * (1 + 7%)^3`            | —           | `1,225.043` |  |
| 8.5 | `32% of 5`                     | `32% * 5`   | `1.6`  |     |
| 8.6 | `20% of 1499`                  | `20% * 1499`| `299.8`|     |
| 8.7 | `52% of 900`                   | `52% * 900` | `468`  |     |
| 8.8 | `what percent is 32 of 200`   | —           | `16%`  |     |
| 8.9 | `what percent of 200 is 32`   | —           | `16%`  |     |
| 8.10| `what percentage of 4 is 1`   | —           | `25%`  |     |
| 8.11| `what percentage is 1 of 4`   | —           | `25%`  |     |

## 9. Syntax highlighting

The parsed expression is coloured per token kind — numbers carry the weight,
operators recede, functions / units / constants keep a faint accent. Verify by
eye on a mixed expression, e.g. `128 GB to MB` (`128` number, `GB`/`MB` unit,
`to` operator) or `sqrt(144)` (`sqrt` function, `144` number). If the lexer can't
fully read the string the panel falls back to plain text.

## 10. Not claimed — nothing shown, query falls through to app search

| #     | Input                              | Why                                          | ✓   |
| ----- | ---------------------------------- | -------------------------------------------- | --- |
| 10.1  | `` (empty) / `   `                 | nothing to evaluate                          |     |
| 10.2  | `chrome`, `notepad`, `sin`, `pi`, `in` | no digit, no function call               |     |
| 10.3  | `42`, `1.5`, `-5`, `1000000`       | a bare number is not a _calculation_         |     |
| 10.4  | `2 pi`, `2 pi extra`               | implicit multiply, no operator — a bare value |    |
| 10.5  | `7zip`, `1password`               | digit then letters — undefined symbol         |     |
| 10.6  | `notepad++`, `1 +`, `(1 + 2`       | doesn't parse                                |     |
| 10.7  | `1 / 0`                            | not finite                                   |     |
| 10.8  | `import("fs")`, `createUnit("foo")`| meta-functions are disabled                  |     |
| 10.9  | `2026-01-15 + 3`                   | ISO date `+`/`-` → handed to `datetime`      |     |
| 10.10 | `sunny plus warm`, `what is love`, `today's news`, `monday.com` | not math |  |

---

```bash
node --test "src/main/calculator/evaluators/math/**/*.test.ts"
```

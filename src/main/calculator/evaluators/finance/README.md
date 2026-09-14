# `finance` evaluator — UAT

Everyday percentage jobs phrased the way people say them (pere-doc #14, plus
#20's interest phrasing). The headline **Result** is the number most people
want; the rest show as chips. A currency on the amount (`£60`, `80 eur`,
`USD 50`) formats every figure in that currency.

Runs before `math`; needs a `%` plus a trigger word, so plain percent math
(`250 - 10%`, `32% of 5`) stays with `math`.

## 1. Discounts

| #   | Input                      | Result   | Chips                                  | ✓   |
| --- | -------------------------- | -------- | -------------------------------------- | --- |
| 1.1 | `20% off 80`               | `64`     | You save `16`                          |     |
| 1.2 | `25% off 129.99`           | `97.49`  | You save `32.50`                       |     |
| 1.3 | `25% off $129.99`          | `$97.49` | You save `$32.50`                      |     |
| 1.4 | `20% discount on 80`       | `64`     | You save `16`                          |     |
| 1.5 | `80 - 20% off`             | `64`     | You save `16`                          |     |
| 1.6 | `80 eur with 20% discount` | `€64.00` | You save `€16.00`                      |     |
| 1.7 | `20% off 80 then 10% off`  | `57.60`  | You save `22.40`, Total discount `28%` |     |
| 1.8 | `10% off 1.2k`             | `1,080`  | You save `120`                         |     |

## 2. Tips

| #   | Input                                   | Result  | Chips                             | ✓   |
| --- | --------------------------------------- | ------- | --------------------------------- | --- |
| 2.1 | `15% tip on 42`                         | `6.30`  | Total `48.30`                     |     |
| 2.2 | `18% tip on 73.50`                      | `13.23` | Total `86.73`                     |     |
| 2.3 | `42 + 15% tip`                          | `6.30`  | Total `48.30`                     |     |
| 2.4 | `tip 15% on $42`                        | `$6.30` | Total `$48.30`                    |     |
| 2.5 | `18% tip on 73.50 split 3`              | `13.23` | Total `86.73`, Per person `28.91` |     |
| 2.6 | `20% tip on 100 split between 4 people` | `20`    | Total `120`, Per person `30`      |     |

## 3. Markup & margin

| #   | Input                     | Result  | Chips                          | ✓   |
| --- | ------------------------- | ------- | ------------------------------ | --- |
| 3.1 | `cost 40 markup 25%`      | `50`    | Markup `10`, Margin `20%`      |     |
| 3.2 | `25% markup on 40`        | `50`    | Markup `10`, Margin `20%`      |     |
| 3.3 | `40 + 25% markup`         | `50`    | Markup `10`, Margin `20%`      |     |
| 3.4 | `buy price 12 markup 40%` | `16.80` | Markup `4.80`, Margin `28.57%` |     |
| 3.5 | `30% margin on 70`        | `100`   | Profit `30`, Markup `42.86%`   |     |

## 4. Tax (VAT / GST / sales tax)

| #   | Input                     | Result   | Chips                        | ✓   |
| --- | ------------------------- | -------- | ---------------------------- | --- |
| 4.1 | `£60 + 20% VAT`           | `£72.00` | Tax `£12.00`                 |     |
| 4.2 | `20% VAT on £60`          | `£72.00` | Tax `£12.00`                 |     |
| 4.3 | `60 plus 8.25% sales tax` | `64.95`  | Tax `4.95`                   |     |
| 4.4 | `100 + 10% GST`           | `110`    | Tax `10`                     |     |
| 4.5 | `£72 incl 20% VAT`        | `£60.00` | Tax `£12.00`, Gross `£72.00` |     |

## 5. Interest & growth (compounds annually unless told otherwise)

| #   | Input                                        | Result      | Chips                             | ✓   |
| --- | -------------------------------------------- | ----------- | --------------------------------- | --- |
| 5.1 | `1500 at 6% for 5 years`                     | `2,007.34`  | Gain `507.34`, Multiple `×1.338`  |     |
| 5.2 | `1000 at 5% simple for 10 years`             | `1,500`     | Interest `500`, Multiple `×1.5`   |     |
| 5.3 | `1000 at 5% for 10 years compounded monthly` | `1,647.01`  | Gain `647.01`, Multiple `×1.647`  |     |
| 5.4 | `1000 usd invested at 7% for 18 months`      | `$1,106.82` | Gain `$106.82`, Multiple `×1.107` |     |
| 5.5 | `invested at 7% after 3 years`               | `×1.225`    | Growth `+22.5%`                   |     |

## 6. Not claimed

| #   | Input                                  | Why                         | ✓   |
| --- | -------------------------------------- | --------------------------- | --- |
| 6.1 | `250 - 10%`, `32% of 5`, `850 + 8.25%` | plain percent math → `math` |     |
| 6.2 | `120% off 80`, `100% margin on 50`     | impossible                  |     |
| 6.3 | `20% off eighty`, `20% off 80 apples`  | not an amount               |     |
| 6.4 | `tip`, `15% tip`, `discount code 20%`  | incomplete                  |     |

```bash
node --test "src/main/calculator/evaluators/finance/*.test.ts"
```

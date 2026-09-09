# `currency` evaluator — UAT

Manual acceptance test. Type each **Input**; the panel shows the conversion
(**Parsed as**) on the left, the converted amount on the right, and a
bottom-right footnote saying how fresh the rates are.

Live results track the exchange-rate feed and move between refreshes. The
**Result** column uses a fixed demo table — **USD 1 · EUR 0.80 · GBP 0.75 · JPY
150** — so it is checkable; against live rates only the number changes, not the
shape. Every row is covered by a test under [`evaluators/currency/`](.).

---

## 1. Recognised input shapes

| #    | Input                    | Parsed as        | Result (demo table) | ✓   |
| ---- | ------------------------ | ---------------- | ------------------- | --- |
| 1.1  | `10 usd in gbp`          | `10 USD → GBP`   | `£7.50`             |     |
| 1.2  | `45 jpy to eur`          | `45 JPY → EUR`   | `€0.24`             |     |
| 1.3  | `$50 in eur`             | `50 USD → EUR`   | `€40.00`            |     |
| 1.4  | `€100 to usd`            | `100 EUR → USD`  | `$125.00`           |     |
| 1.5  | `10 dollars in euros`    | `10 USD → EUR`   | `€8.00`             |     |
| 1.6  | `5 pounds to yen`        | `5 GBP → JPY`    | `¥1,000`            |     |
| 1.7  | `1,000 usd in eur`       | `1,000 USD → EUR`| `€800.00`           |     |
| 1.8  | `1.2k dollars in yen`    | `1,200 USD → JPY`| `¥180,000`          |     |
| 1.9  | `$1.5k in eur`           | `1,500 USD → EUR`| `€1,200.00`         |     |
| 1.10 | `usd in eur`             | `1 USD → EUR`    | `€0.80` (no amount ⇒ rate for 1) |  |
| 1.11 | `10 usd to eur.`         | `10 USD → EUR`   | `€8.00` (trailing dot tolerated) |  |
| 1.12 | `-5 usd in eur`          | `-5 USD → EUR`   | `-€4.00`            |     |

`in` and `to` are interchangeable everywhere.

## 2. Amount forms

| #   | Input                 | Amount parsed | ✓   |
| --- | --------------------- | ------------- | --- |
| 2.1 | `500 gbp to thb`      | `500`         |     |
| 2.2 | `1,000 usd in eur`    | `1000` (grouped input) |  |
| 2.3 | `1.2k dollars in yen` | `1200` (`k` shorthand) |  |
| 2.4 | `2m cad to usd`       | `2,000,000` (`m` shorthand) |  |
| 2.5 | `-5 usd in eur`       | `-5` (leading minus) |  |
| 2.6 | *(no amount)* `usd in eur` | `1` |  |

## 3. Currency-token forms

Codes starting with `k` / `m` / `b` must **not** lose their first letter to the
magnitude shorthand.

| #   | Input               | From → To  | ✓   |
| --- | ------------------- | ---------- | --- |
| 3.1 | ISO code — `10 usd in gbp`         | USD → GBP |  |
| 3.2 | symbol — `$50 in eur`, `€100 to usd` | USD / EUR |  |
| 3.3 | full name — `10 dollars in euros`, `swedish krona`, `west african cfa franc` | resolves to code |  |
| 3.4 | nickname — `5 pounds to yen`, `bucks`, `quid`, `peso`, `baht` | curated default |  |
| 3.5 | `5000 khr to usd`   | KHR → USD (not `k` + `hr`) |  |
| 3.6 | `2000 mxn to usd`   | MXN → USD |  |
| 3.7 | `100 bnd in eur`    | BND → EUR |  |
| 3.8 | `2m khr in usd`     | KHR → USD, amount `2,000,000` (real `m` suffix still works) |  |

All 166 ISO currencies resolve — the table with names is
[`CURRENCIES`](currencies.ts). Ambiguous names/symbols take a curated default:
`peso` → MXN, `franc` → CHF, `krona` → SEK, `$` → USD, `₦` → NGN, `฿` → THB.
Conversion is gated on the feed's live set of codes.

## 4. Rate-freshness footnote

Bottom-right of the value. Coarsens as the last successful fetch ages:

| Age since last fetch | Footnote              | ✓   |
| -------------------- | --------------------- | --- |
| < 45 s               | `Updated just now`    |     |
| 1 min                | `Updated 1 minute ago`|     |
| 4 min                | `Updated 4 minutes ago`|    |
| ~3 h                 | `Updated 3 hours ago` |     |
| ~1 day               | `Updated yesterday`   |     |
| 5 days               | `Updated 5 days ago`  |     |
| ~40 days             | `Updated 1 month ago` |     |
| feed never loaded    | `Rates unavailable`   |     |

## 5. Not claimed — nothing shown, query falls through

| #   | Input                | Why                                  | ✓   |
| --- | -------------------- | ------------------------------------ | --- |
| 5.1 | `5 + 5`              | plain math                           |     |
| 5.2 | `128 GB to MB`, `10 m to ft` | not currencies (→ `math` units) |  |
| 5.3 | `5 min to timespan`  | not a currency                       |     |
| 5.4 | `10 in eur`          | no source currency                   |     |
| 5.5 | `10 usd`             | no target currency                   |     |
| 5.6 | `10 xyz in usd`      | unknown code                         |     |
| 5.7 | `left half`, `chrome`, `` (empty) | not a currency query    |     |

No crypto — see the `cryptocurrency-conversion` research doc.

---

```bash
node --test "src/main/calculator/evaluators/currency/**/*.test.ts"
```

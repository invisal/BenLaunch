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

| #    | Input                 | Parsed as         | Result (demo table)              | ✓   |
| ---- | --------------------- | ----------------- | -------------------------------- | --- |
| 1.1  | `10 usd in gbp`       | `10 USD → GBP`    | `£7.50`                          |     |
| 1.2  | `45 jpy to eur`       | `45 JPY → EUR`    | `€0.24`                          |     |
| 1.3  | `$50 in eur`          | `50 USD → EUR`    | `€40.00`                         |     |
| 1.4  | `€100 to usd`         | `100 EUR → USD`   | `$125.00`                        |     |
| 1.5  | `10 dollars in euros` | `10 USD → EUR`    | `€8.00`                          |     |
| 1.6  | `5 pounds to yen`     | `5 GBP → JPY`     | `¥1,000`                         |     |
| 1.7  | `1,000 usd in eur`    | `1,000 USD → EUR` | `€800.00`                        |     |
| 1.8  | `1.2k dollars in yen` | `1,200 USD → JPY` | `¥180,000`                       |     |
| 1.9  | `$1.5k in eur`        | `1,500 USD → EUR` | `€1,200.00`                      |     |
| 1.10 | `usd in eur`          | `1 USD → EUR`     | `€0.80` (no amount ⇒ rate for 1) |     |
| 1.11 | `10 usd to eur.`      | `10 USD → EUR`    | `€8.00` (trailing dot tolerated) |     |
| 1.12 | `-5 usd in eur`       | `-5 USD → EUR`    | `-€4.00`                         |     |

`in` and `to` are interchangeable everywhere.

## 2. Amount forms

| #   | Input                      | Amount parsed               | ✓   |
| --- | -------------------------- | --------------------------- | --- |
| 2.1 | `500 gbp to thb`           | `500`                       |     |
| 2.2 | `1,000 usd in eur`         | `1000` (grouped input)      |     |
| 2.3 | `1.2k dollars in yen`      | `1200` (`k` shorthand)      |     |
| 2.4 | `2m cad to usd`            | `2,000,000` (`m` shorthand) |     |
| 2.5 | `-5 usd in eur`            | `-5` (leading minus)        |     |
| 2.6 | _(no amount)_ `usd in eur` | `1`                         |     |

## 3. Currency-token forms

Codes starting with `k` / `m` / `b` must **not** lose their first letter to the
magnitude shorthand.

| #   | Input                                                                        | From → To                                                   | ✓   |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- | --- |
| 3.1 | ISO code — `10 usd in gbp`                                                   | USD → GBP                                                   |     |
| 3.2 | symbol — `$50 in eur`, `€100 to usd`                                         | USD / EUR                                                   |     |
| 3.3 | full name — `10 dollars in euros`, `swedish krona`, `west african cfa franc` | resolves to code                                            |     |
| 3.4 | nickname — `5 pounds to yen`, `bucks`, `quid`, `peso`, `baht`                | curated default                                             |     |
| 3.5 | `5000 khr to usd`                                                            | KHR → USD (not `k` + `hr`)                                  |     |
| 3.6 | `2000 mxn to usd`                                                            | MXN → USD                                                   |     |
| 3.7 | `100 bnd in eur`                                                             | BND → EUR                                                   |     |
| 3.8 | `2m khr in usd`                                                              | KHR → USD, amount `2,000,000` (real `m` suffix still works) |     |

All 166 ISO currencies resolve — the table with names is
[`CURRENCIES`](currencies.ts). Ambiguous names/symbols take a curated default:
`peso` → MXN, `franc` → CHF, `krona` → SEK, `$` → USD, `₦` → NGN, `฿` → THB.
Conversion is gated on the feed's live set of codes.

## 4. Rate-freshness footnote

Bottom-right of the value. Coarsens as the last successful fetch ages:

| Age since last fetch | Footnote                | ✓   |
| -------------------- | ----------------------- | --- |
| < 45 s               | `Updated just now`      |     |
| 1 min                | `Updated 1 minute ago`  |     |
| 4 min                | `Updated 4 minutes ago` |     |
| ~3 h                 | `Updated 3 hours ago`   |     |
| ~1 day               | `Updated yesterday`     |     |
| 5 days               | `Updated 5 days ago`    |     |
| ~40 days             | `Updated 1 month ago`   |     |
| feed never loaded    | `Rates unavailable`     |     |

## 4b. Shorthand amounts (no target)

| #    | Input          | Parsed as         | Result          | ✓   |
| ---- | -------------- | ----------------- | --------------- | --- |
| 4b.1 | `USD1K`        | `1,000 USD`       | `$1,000.00`     |     |
| 4b.2 | `EUR 2.5M`     | `2,500,000 EUR`   | `€2,500,000.00` |     |
| 4b.3 | `10k usd`      | `10,000 USD`      | `$10,000.00`    |     |
| 4b.4 | `$1.5k`        | `1,500 USD`       | `$1,500.00`     |     |
| 4b.5 | `USD1K in eur` | `1,000 USD → EUR` | `€800.00`       |     |

## 4c. Crypto (Settings → Calculator → Crypto prices)

Demo prices: **BTC $64,000 · ETH $3,000 · SOL $150**, fetched 14:05. Prices
refresh every 10 minutes from CoinGecko; there is no bundled price seed, so
crypto only resolves after the first successful fetch. Needs an explicit
amount (`sol`, `eth`, `dot` are also words).

| #    | Input                          | Parsed as        | Result                        | Footnote             | ✓   |
| ---- | ------------------------------ | ---------------- | ----------------------------- | -------------------- | --- |
| 4c.1 | `5 btc in gbp`                 | `5 BTC → GBP`    | `£240,000.00`                 | `Prices as of 14:05` |     |
| 4c.2 | `0.2 eth to usd`               | `0.2 ETH → USD`  | `$600.00`                     | `Prices as of 14:05` |     |
| 4c.3 | `1 usd in btc`                 | `1 USD → BTC`    | `0.000015625 BTC`             |                      |     |
| 4c.4 | `10 sol in eur`                | `10 SOL → EUR`   | `€1,200.00` (`sol` is Solana) |                      |     |
| 4c.5 | `2 sol in eth`                 | `2 SOL → ETH`    | `0.1 ETH`                     |                      |     |
| 4c.6 | `0.05 bitcoin in usd`          | `0.05 BTC → USD` | `$3,200.00`                   |                      |     |
| 4c.7 | `sol in usd`                   | —                | _nothing — no amount_         |                      |     |
| 4c.8 | `5 btc in gbp` with crypto off | —                | _nothing_                     |                      |     |

## 4d. Rates per unit

A day is 24 hours; a `workday` is 8. Units convert within a dimension (time,
volume, mass, length).

| #    | Input                            | Parsed as                   | Result                | ✓   |
| ---- | -------------------------------- | --------------------------- | --------------------- | --- |
| 4d.1 | `8 dollars/hour in gbp`          | `8 USD/hour → GBP/hour`     | `£6.00/hour`          |     |
| 4d.2 | `65 usd/hour in eur/day`         | `65 USD/hour → EUR/day`     | `€1,248.00/day`       |     |
| 4d.3 | `65 usd per hour in eur/workday` | `65 USD/hour → EUR/workday` | `€416.00/workday`     |     |
| 4d.4 | `£1.50/L in $/gal`               | `1.5 GBP/L → USD/gal`       | `$7.57/gal`           |     |
| 4d.5 | `10 usd/kg in gbp/lb`            | `10 USD/kg → GBP/lb`        | `£3.40/lb`            |     |
| 4d.6 | `10 usd/kg in eur/hour`          | —                           | _nothing — kg ≠ time_ |     |

Not supported: historical rates (`… at 2022/9/25`) — the free feed has no
history and `evaluate()` stays synchronous.

## 5. Not claimed — nothing shown, query falls through

| #   | Input                             | Why                             | ✓   |
| --- | --------------------------------- | ------------------------------- | --- |
| 5.1 | `5 + 5`                           | plain math                      |     |
| 5.2 | `128 GB to MB`, `10 m to ft`      | not currencies (→ `math` units) |     |
| 5.3 | `5 min to timespan`               | not a currency                  |     |
| 5.4 | `10 in eur`                       | no source currency              |     |
| 5.5 | `10 usd`, `$5`                    | no target, no magnitude suffix  |     |
| 5.6 | `10 xyz in usd`                   | unknown code                    |     |
| 5.7 | `left half`, `chrome`, `` (empty) | not a currency query            |     |

---

```bash
node --test "src/main/calculator/evaluators/currency/**/*.test.ts"
```

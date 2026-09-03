# `currency` evaluator

Live fiat currency conversion — `10 usd in gbp`, `45 jpy to inr`, `$50 in eur`.
In the [pipeline](../../index.ts) as `const evaluators = [math, currency]`;
`math` in front is harmless (its parser throws on `usd` and returns `null`).

## How it works

```
input ─▶ parse ─▶ convert (rates from the source) ─▶ formatMoney ─▶ Calculation
         (find a currency query)   (base-relative table)   (Intl currency)
```

| Module | Responsibility |
|---|---|
| [parse.ts](parse.ts) | `"1.2k dollars in yen"` → `{ amount: 1200, from: 'USD', to: 'JPY' }` |
| [currencies.ts](currencies.ts) | `CURRENCIES` (all 166 codes → names) + `resolveCurrency(token, known)` — code / symbol / name → ISO code |
| [convert.ts](convert.ts) | `amount · rate[to] / rate[from]` |
| [format.ts](format.ts) | `Intl.NumberFormat` currency style — symbol + per-currency decimals |
| [index.ts](index.ts) | `const currency` (reads `currentRates()`) + `createCurrencyEvaluator(provider)` for tests |

The rate numbers come from the
[`exchange-rate` source](../../../sources/calculator/exchange-rate/) — a normal
`ActionSource` (in the `sources` array in `actions.ts`) that contributes no
actions and just keeps a shared rate table fresh. The evaluator imports
`currentRates()` from its `store.ts` and depends on a narrow `RateProvider`
interface (`rates()` / `updatedAgeMs()`) so tests can inject a fake.

**It is synchronous.** The evaluator reads whatever the store currently holds;
fetching happens in the background (the base `CachedActionSource` refreshes on
every launcher show, throttled to 6 h). Before the first fetch the bundled seed
is used. Every result carries a `footnote` — `"Updated just now"` /
`"Updated 4 minutes ago"` / `"Updated yesterday"` / `"Updated 3 days ago"` —
that the panel shows bottom-right of the value (`updatedLabel()` in
[format.ts](format.ts), measured from the last successful fetch).

## Supported use cases

| Query | Result |
|---|---|
| `10 usd in gbp` | `£7.42` |
| `45 jpy to inr` | `₹26.84` |
| `500 gbp to thb` | `฿22,389.12` |
| `$50 in eur` | `€43.17` |
| `€100 to usd` | `$115.83` |
| `10 dollars in euros` | `€8.64` |
| `5 pounds to yen` | `¥955` |
| `1,000 usd in eur` | `€863.71` |
| `1.2k dollars in yen` | `¥190,907` |
| `2m cad to usd` | `$1,436,600.00` |
| `convert 100 eur to usd` | `$115.83` (the `convert` lead-in is stripped upstream) |
| `usd in eur` | `€0.86` — the rate for 1, when no amount is given |

**Amounts:** plain, `1,000` grouped, or `k` / `m` / `b` shorthand.
**Currencies:** ISO code (`usd`), symbol (`$ £ € ¥ ₹ ₩ ₽ ₺ ฿ ₫ ₱ ₪ ₦ ₴ …`), full
name (`swedish krona`, `west african cfa franc`), or nickname (`bucks`, `quid`,
`peso`, `baht`). All 166 currencies — the list with names is
[`CURRENCIES`](currencies.ts). Conversion is gated on the source's live set of
codes, so it always matches what a rate exists for.

## Not claimed (returns `null` → math / action search)

`5 + 5`, `128 GB to MB`, `10 m to ft`, `10 in eur` (no source currency),
`10 usd` (no target), `10 xyz in usd` (unknown code), plain words.

No crypto — see the `cryptocurrency-conversion` research doc (a second price
feed added to the `exchange-rate` source).

## Tests

`parse`, `convert`, `format` are pure and table-tested; `index.test.ts` drives
`createCurrencyEvaluator` with a fake `RateProvider`. The rate plumbing is tested
under
[`sources/calculator/exchange-rate/`](../../../sources/calculator/exchange-rate/).

```bash
node --test "src/main/calculator/evaluators/currency/**/*.test.ts"
```

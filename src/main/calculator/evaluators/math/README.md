# `math` evaluator

Arithmetic and everything [`mathjs`](https://mathjs.org) already understands.
First (and, for now, only) evaluator in the calculator pipeline
([../../index.ts](../../index.ts)).

Input arrives already framed by the shared
[calculator/normalize.ts](../../normalize.ts) — the "what is …" lead-in and any
trailing `=` / `equals` / `?` are gone before this evaluator runs.

## How it works

```
input ─▶ normalizeMath ─▶ gate ─▶ evaluate ─▶ format ─▶ tokenize ─▶ Calculation
         (spoken →         (is it   (mathjs)   (value +   (syntax
          symbols)          math?)              rawValue)  highlight)
```

| Module | Responsibility |
|---|---|
| [normalize.ts](normalize.ts) | Spoken operators, `× ÷ − π`, `3x4` → strict `mathjs` syntax |
| [gate.ts](gate.ts) | `looksLikeMath` (needs a digit or `fn(`) + `isCalculation` (reject bare literals) |
| [evaluate.ts](evaluate.ts) | The `mathjs` instance; parse + evaluate, meta-functions neutered |
| [format.ts](format.ts) | `value` (grouped, for display) and `rawValue` (plain, for pasting) |
| [tokenize.ts](tokenize.ts) | Split the expression into typed `CalcToken`s for the renderer |
| [index.ts](index.ts) | Wires the above into the `Evaluator` |

`Calculation` (in [src/shared/types.ts](../../../../shared/types.ts)) carries
`expression` (the math-normalized form), `value`, `rawValue`, and `tokens?`.

## Supported use cases

### 1. Plain arithmetic

Precedence, parentheses, negatives, decimals, big-number grouping.

| Query | Result |
|---|---|
| `60 + 74` | `134` |
| `2+3*4` | `14` |
| `(3 + 4) * 2` | `14` |
| `10 / 4` | `2.5` |
| `-5 + 8` | `3` |
| `2 ^ 10` | `1,024` |
| `2 ^ 3 ^ 2` | `512` (right-associative) |
| `10 % 3` | `1` |
| `0.1 + 0.2` | `0.3` (float noise trimmed) |
| `1000000 * 2` | `2,000,000` |

### 2. Spoken operators

Rewritten only when the word sits between two operands, so "sunny plus warm"
still isn't math.

| Word form | Becomes | Example | Result |
|---|---|---|---|
| `plus` | `+` | `5 plus 3` | `8` |
| `minus` | `-` | `10 minus 4` | `6` |
| `times`, `multiplied by` | `*` | `6 times 7` | `42` |
| `divided by` | `/` | `100 divided by 4` | `25` |
| `mod`, `modulo` | `%` | `17 mod 5` | `2` |
| `power`, `pow`, `to the power of` | `^` | `2 to the power of 8` | `256` |

Case-insensitive (`5 PLUS 3`), chainable (`1 plus 2 plus 3` → `6`).

### 3. Symbol variants

| Query | Normalized | Result |
|---|---|---|
| `12 × 3` | `12 * 3` | `36` |
| `100 ÷ 4` | `100 / 4` | `25` |
| `8 − 5` (U+2212, or en/em dash) | `8 - 5` | `3` |
| `2π` | `2 pi` | *(bare value — not shown, see below)* |

### 4. "x" as multiply

Only wedged between two numbers — the `x` in `max(2, 3)` is left alone.

| Query | Normalized | Result |
|---|---|---|
| `3 x 4` | `3 * 4` | `12` |
| `3x4` | `3 * 4` | `12` |

### 5. Question phrasing & trailing punctuation

Handled *upstream* by [calculator/normalize.ts](../../normalize.ts), so the math
evaluator never sees it — but it's part of the same "type it how you'd say it"
experience.

| Query | Reaches math as | Result |
|---|---|---|
| `what is 7 * 6` | `7 * 6` | `42` |
| `calculate 100 / 4` | `100 / 4` | `25` |
| `9 + 10 =` | `9 + 10` | `19` |
| `5 * 5 equals` | `5 * 5` | `25` |

### 6. Functions & constants

Anything the bare `mathjs` grammar understands.

| Query | Result |
|---|---|
| `sqrt(144)` | `12` |
| `sin(30 deg)` | `0.5` |
| `log(1000, 10)` | `3` |
| `3!` | `6` (factorial) |
| `2 * pi` | `6.28318530718` |

### 7. Unit-aware math

`mathjs` keeps units through the operation and converts on `in` / `to`.

| Query | Result |
|---|---|
| `128 GB to MB` | `128000 MB` |
| `20 degC to degF` | `68 degF` |
| `10 cm in mm` | `100 mm` |
| `1 kg + 2 g` | `1.002 kg` |

### 8. Syntax highlighting

The normalized expression is tokenized ([tokenize.ts](tokenize.ts)) and painted
per-kind — numbers carry the weight, operators recede, units / functions /
constants keep a faint accent — by
[ExpressionTokens.tsx](../../../../renderer/src/screens/launcher/components/ExpressionTokens.tsx)
inside the calculator panel
([CalculatorPanel.tsx](../../../../renderer/src/screens/launcher/components/CalculatorPanel.tsx)),
using the `--color-syntax-*` theme vars in
[index.css](../../../../renderer/src/index.css). If the lexer can't fully consume
the string, `tokens` is omitted and the panel shows plain text.

## Not claimed (returns `null` → next evaluator / action search)

| Query | Why |
|---|---|
| `chrome`, `sin`, `pi`, `in` | no digit, no function call |
| `42`, `1.5`, `-5` | a bare number is not a *calculation* |
| `2 pi` | implicit multiplication, no operator — a bare value |
| `7zip`, `1password` | digit then letters — `mathjs` throws on the undefined symbol |
| `notepad++`, `1 +`, `(1 + 2` | doesn't parse |
| `1 / 0` | not finite |
| `import("fs")`, `createUnit("x")` | meta-functions are disabled |

## Tests

Each module has a `*.test.ts`; [index.test.ts](index.test.ts) drives
`math.evaluate()` end-to-end. Full-pipeline cases (framing, chain fall-through)
live in [../../index.test.ts](../../index.test.ts).

```bash
node --test "src/main/calculator/**/*.test.ts"
```

> **Node ESM:** `npm test` runs on Node 22's type-stripping, which does no
> extension guessing — every relative import in a non-test `.ts` file carries an
> explicit `.ts` extension. Vite honours the same specifiers in the build.

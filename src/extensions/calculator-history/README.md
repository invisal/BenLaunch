# Calculator History

Raycast's **Calculator History** and **pinned calculations**, as a launcher
extension. Every calculator result you _act on_ is recorded; the history
screen searches, copies, re-runs and pins them; pinned calculations sit at the
top of the empty launcher and stay live.

UAT — reference clock `Sun, Sep 13, 2026 12:00`.

## 1. Recording (launcher calculator row)

| #   | Input / action                              | Result                                                        | ✓   |
| --- | ------------------------------------------- | ------------------------------------------------------------- | --- |
| 1.1 | type `6 * 7`, press `↵`                     | `42` copied; entry `6 * 7 = 42` recorded                      |     |
| 1.2 | type `6 * 7`, don't act, clear the query    | nothing recorded                                              |     |
| 1.3 | type `6 * 7`, press `↵` again later         | still one entry, moved to the top                             |     |
| 1.4 | type `1000 * 2`, press `⌥↵`                 | `2000` (unformatted) copied; recorded                         |     |
| 1.5 | type `10 usd in gbp`, press `⇧⌘↵`           | `10 usd in gbp = £7.42` copied; recorded                      |     |
| 1.6 | type `1920 / 2`, press `⌘↵`                 | query becomes `960`; `1920 / 2` recorded                      |     |
| 1.7 | calc row `⌘K` → **Pin Calculation**         | recorded and pinned; appears at the top of the empty launcher |     |
| 1.8 | calc row `⌘K` → **Open Calculator History** | history screen opens                                          |     |

## 2. History screen (`Calculator History` command)

| #    | Input / action                                   | Result                                                           | ✓   |
| ---- | ------------------------------------------------ | ---------------------------------------------------------------- | --- |
| 2.1  | type `calculator history`, `↵`                   | history screen opens, newest first, pinned entries first         |     |
| 2.2  | row shows                                        | `6 * 7` · `= 42` · badge `5m ago` (or `Pinned`)                  |     |
| 2.3  | search `usd`                                     | matches by query, expression or result (`£7.42`)                 |     |
| 2.4  | `↵` on a row                                     | result copied, launcher closes                                   |     |
| 2.5  | `⌘K` → Copy Unformatted / Copy Question & Answer | `7.42` / `10 usd in gbp = £7.42` copied                          |     |
| 2.6  | `⌘K` → Re-run in Launcher                        | back to the search view with the query filled in                 |     |
| 2.7  | `⌘K` → Pin / Unpin                               | badge toggles; pinned entries move to the top                    |     |
| 2.8  | pin an 11th entry                                | refused; footer reads `Pin limit reached — unpin one first`      |     |
| 2.9  | `⌘K` → Delete Entry (select twice)               | entry removed                                                    |     |
| 2.10 | `⌘K` → Clear History (select twice)              | every unpinned entry removed; pins stay                          |     |
| 2.11 | empty history                                    | `No calculations yet. Copy a calculator result to save it here.` |     |
| 2.12 | restart the app                                  | history and pins are still there                                 |     |

## 3. Pinned calculations (empty launcher)

| #   | Pinned query                    | Row                                             | ✓   |
| --- | ------------------------------- | ----------------------------------------------- | --- |
| 3.1 | `1 usd in eur`                  | 🧮 `1 usd in eur` · live `€0.86` (latest rates) |     |
| 3.2 | `days until 25 Dec`             | counts down each day                            |     |
| 3.3 | `time in Tokyo`                 | current Tokyo time each time the launcher opens |     |
| 3.4 | offline / query stops resolving | last known value                                |     |
| 3.5 | `↵` on the row                  | live value copied                               |     |
| 3.6 | `⌘K` → Copy Question & Answer   | `time in Tokyo = 01:05 · GMT+9` copied          |     |
| 3.7 | `⌘K` → Refresh                  | value re-computed now                           |     |
| 3.8 | `⌘K` → Unpin Calculation        | row disappears from the launcher                |     |
| 3.9 | `⌘K` → Open Calculator History  | history screen opens                            |     |

Limits: 500 unpinned entries (oldest dropped), 10 pins (never dropped).
Storage: `<userData>/extensions/calculator-history.json`.

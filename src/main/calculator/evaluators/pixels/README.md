# `pixels` evaluator — UAT

Physical units ↔ pixels at a density (pere-doc #21). Units: `in` (`inch`,
`"`), `cm`, `mm`, `pt` (1/72 in), `pc` (pica). Density `at|@ N ppi|dpi`; when
omitted, 96 ppi (the CSS reference) and the chip says so. Requires a `px` token.

| #    | Input                          | Result     | Density chip       | ✓   |
| ---- | ------------------------------ | ---------- | ------------------ | --- |
| 1.1  | `2 inches in px at 72 ppi`     | `144 px`   | `72 ppi`           |     |
| 1.2  | `1 cm in px at 96 dpi`         | `37.8 px`  | `96 ppi`           |     |
| 1.3  | `300 px in mm at 300 dpi`      | `25.4 mm`  | `300 ppi`          |     |
| 1.4  | `12pt in px`                   | `16 px`    | `96 ppi (default)` |     |
| 1.5  | `3.5 in in px at 300 dpi`      | `1,050 px` | `300 ppi`          |     |
| 1.6  | `10 mm in px at 72 ppi`        | `28.35 px` | `72 ppi`           |     |
| 1.7  | `1024 px in inches at 220 ppi` | `4.655 in` | `220 ppi`          |     |
| 1.8  | `16 px to pt`                  | `12 pt`    | `96 ppi (default)` |     |
| 1.9  | `96 pixels to inches`          | `1 in`     | `96 ppi (default)` |     |
| 1.10 | `1 pica in px`                 | `16 px`    | `96 ppi (default)` |     |
| 1.11 | `600 px in cm @ 300dpi`        | `5.08 cm`  | `300 ppi`          |     |
| 1.12 | `2" to px at 72 ppi`           | `144 px`   | `72 ppi`           |     |

## Not claimed

| #   | Input                             | Why                       | ✓   |
| --- | --------------------------------- | ------------------------- | --- |
| 2.1 | `10 cm in mm`                     | no `px` → `math`          |     |
| 2.2 | `5 px in px`, `10 px`, `px to cm` | nothing to convert        |     |
| 2.3 | `10 px to ft`                     | unsupported physical unit |     |
| 2.4 | `2 inches in px at 0 ppi`         | invalid density           |     |

```bash
node --test "src/main/calculator/evaluators/pixels/*.test.ts"
```

import type { MathJsInstance } from "mathjs";

/**
 * Units `mathjs` lacks or defines differently from what people mean, added to
 * the math evaluator's instance *before* its meta-functions (`createUnit`,
 * `import`) are disabled — see `evaluate.ts`.
 *
 *  - US kitchen measures. `mathjs`'s `teaspoon`/`tablespoon` are the metric
 *    5 mL / 15 mL; a recipe (and Raycast) means the US 4.93 mL / 14.79 mL.
 *  - Data rates. `mathjs` has bits (`Mb`) but no `Mbps`, so `3 GB / 25 Mbps`
 *    failed; with `bps` defined it resolves to a duration.
 */
export function defineUnits(mathjs: MathJsInstance): void {
  mathjs.createUnit(
    {
      teaspoon: {
        definition: "4.92892159375 mL",
        aliases: ["teaspoons", "tsp"],
      },
      tablespoon: {
        definition: "14.78676478125 mL",
        aliases: ["tablespoons", "tbsp"],
      },
    },
    { override: true },
  );
  mathjs.createUnit({
    bps: { definition: "1 b/s", prefixes: "short" },
  });
}

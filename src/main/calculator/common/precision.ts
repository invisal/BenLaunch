/**
 * Display rounding for measured quantities (unit conversions, pixel sizes,
 * ratios' decimals) — Raycast-style "enough digits to be useful, never a
 * wall of them": keep at least 2 decimal places, but never fewer than 4
 * significant digits.
 *
 *   62.137119 → 62.14     121.92 → 121.92     1.609344 → 1.609
 *   3.048     → 3.048     0.416666 → 0.4167   32808.4 → 32808.4
 *
 * Plain arithmetic keeps its own 12-significant-digit tidy (`math/format.ts`) —
 * this is only for results where the input itself was a measurement.
 */
export function roundDisplay(n: number): number {
  if (!Number.isFinite(n) || n === 0) return n;
  const abs = Math.abs(n);
  if (abs < 1) return Number(n.toPrecision(4));
  const intDigits = Math.floor(Math.log10(abs)) + 1;
  const decimals = Math.max(2, 4 - intDigits);
  return Number(n.toFixed(decimals));
}

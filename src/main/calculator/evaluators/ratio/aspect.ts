/**
 * Common display/photo aspect ratios, for the "Aspect" chip on a ratio result.
 * `1920 : 1080` is exactly 16:9; `1366 : 768` is only *nearly* 16:9 (683:384),
 * so it reads `≈ 16:9 Widescreen`.
 */
const KNOWN: ReadonlyArray<readonly [number, number, string]> = [
  [16, 9, "Widescreen"],
  [16, 10, "Widescreen"],
  [4, 3, "Standard"],
  [3, 2, "Classic 35mm"],
  [21, 9, "Ultrawide"],
  [32, 9, "Super ultrawide"],
  [5, 4, "Large format"],
  [1, 1, "Square"],
  [9, 16, "Vertical"],
];

/** How close (relative) a ratio must be to count as "≈" a known one. */
const TOLERANCE = 0.01;

export function aspectName(p: number, q: number): string | null {
  if (p <= 0 || q <= 0) return null;
  for (const [w, h, name] of KNOWN) {
    if (p * h === q * w) return `${w}:${h} ${name}`;
  }
  const ratio = p / q;
  for (const [w, h, name] of KNOWN) {
    if (Math.abs(ratio / (w / h) - 1) <= TOLERANCE)
      return `≈ ${w}:${h} ${name}`;
  }
  return null;
}

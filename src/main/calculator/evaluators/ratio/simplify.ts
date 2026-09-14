/** Greatest common divisor of two non-negative integers. */
export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}

/** Decimal places in `n` as typed — `1.5` → 1, `2` → 0. Capped so float noise can't blow up the scale. */
function decimals(n: number): number {
  const text = String(n);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : Math.min(text.length - dot - 1, 6);
}

/**
 * `1920 : 1080` → `[16, 9]`; `1.5 : 1` → `[3, 2]`; `0 : 5` → `[0, 1]`.
 * Decimals are scaled up to integers first so the gcd is exact.
 */
export function simplifyRatio(a: number, b: number): [number, number] {
  const scale = 10 ** Math.max(decimals(a), decimals(b));
  const x = Math.round(a * scale);
  const y = Math.round(b * scale);
  const divisor = gcd(x, y) || 1;
  return [x / divisor, y / divisor];
}

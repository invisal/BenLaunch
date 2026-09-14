/** Greatest common divisor of two non-negative integers. */
export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}

/**
 * Decimal places in `n` — `1.5` → 1, `2` → 0, `0.0000001` → 7. `String(n)`
 * switches to exponent form for small numbers (`1e-7`), so the exponent is
 * counted too.
 */
function decimals(n: number): number {
  const [mantissa, exponent = "0"] = String(n).split("e");
  const fraction = mantissa.split(".")[1]?.length ?? 0;
  return Math.max(0, fraction - Number(exponent));
}

/**
 * `1920 : 1080` → `[16, 9]`; `1.5 : 1` → `[3, 2]`; `0 : 5` → `[0, 1]`.
 * Decimals are scaled up to integers first so the gcd is exact. `null` when
 * that scaling would leave safe-integer range — returning a different ratio
 * than the one typed would be worse than no answer.
 */
export function simplifyRatio(a: number, b: number): [number, number] | null {
  const scale = 10 ** Math.max(decimals(a), decimals(b));
  const x = Math.round(a * scale);
  const y = Math.round(b * scale);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return null;
  if ((a !== 0 && x === 0) || (b !== 0 && y === 0)) return null;
  const divisor = gcd(x, y) || 1;
  return [x / divisor, y / divisor];
}

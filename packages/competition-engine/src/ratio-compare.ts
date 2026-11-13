export interface Ratio {
  num: number;
  den: number;
}

/**
 * Compares a.num/a.den with b.num/b.den without dividing: cross-multiplication, so a player
 * who lost no games (den 0) never causes NaN/Infinity. Both den 0 -> equal; only one den 0 -> that one is larger.
 * Returns >0 when a is larger, <0 when b is larger, 0 when equal.
 */
export function compareRatio(a: Ratio, b: Ratio): number {
  if (a.den === 0 && b.den === 0) return 0;
  if (a.den === 0) return 1;
  if (b.den === 0) return -1;
  return a.num * b.den - b.num * a.den;
}

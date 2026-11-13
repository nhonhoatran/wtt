import { describe, expect, it } from 'vitest';
import { compareRatio } from './ratio-compare.js';

describe('compareRatio', () => {
  it('compares by cross-multiplication', () => {
    expect(compareRatio({ num: 6, den: 4 }, { num: 5, den: 4 })).toBeGreaterThan(0);
    expect(compareRatio({ num: 1, den: 3 }, { num: 1, den: 2 })).toBeLessThan(0);
    expect(compareRatio({ num: 2, den: 4 }, { num: 1, den: 2 })).toBe(0);
  });

  it('treats a zero denominator on both sides as equal', () => {
    expect(compareRatio({ num: 3, den: 0 }, { num: 7, den: 0 })).toBe(0);
    expect(compareRatio({ num: 0, den: 0 }, { num: 0, den: 0 })).toBe(0);
  });

  it('ranks a zero denominator above any finite ratio', () => {
    expect(compareRatio({ num: 3, den: 0 }, { num: 99, den: 1 })).toBeGreaterThan(0);
    expect(compareRatio({ num: 99, den: 1 }, { num: 3, den: 0 })).toBeLessThan(0);
  });

  it('handles a zero numerator without dividing', () => {
    expect(compareRatio({ num: 0, den: 5 }, { num: 0, den: 2 })).toBe(0);
    expect(compareRatio({ num: 0, den: 5 }, { num: 1, den: 9 })).toBeLessThan(0);
  });
});

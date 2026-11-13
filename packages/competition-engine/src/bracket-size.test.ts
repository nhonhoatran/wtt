import { describe, expect, it } from 'vitest';
import { bracketSize, isPowerOfTwo, partnerPosition, roundCountForSize, splitEvenly } from './bracket-size.js';
import { DrawParamsError } from './types.js';

describe('bracketSize', () => {
  it.each([
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 4],
    [5, 8],
    [8, 8],
    [17, 32],
    [51, 64],
    [64, 64],
    [100, 128],
    [128, 128],
    [129, 256],
  ])('n=%i -> %i', (n, expected) => {
    expect(bracketSize(n)).toBe(expected);
  });

  it('rejects negative or fractional counts', () => {
    expect(() => bracketSize(-1)).toThrow(DrawParamsError);
    expect(() => bracketSize(2.5)).toThrow(DrawParamsError);
  });
});

describe('helpers', () => {
  it('detects powers of two', () => {
    expect(isPowerOfTwo(1)).toBe(true);
    expect(isPowerOfTwo(64)).toBe(true);
    expect(isPowerOfTwo(0)).toBe(false);
    expect(isPowerOfTwo(12)).toBe(false);
    expect(isPowerOfTwo(2.5)).toBe(false);
  });

  it('counts rounds and rejects invalid sizes', () => {
    expect(roundCountForSize(2)).toBe(1);
    expect(roundCountForSize(64)).toBe(6);
    expect(() => roundCountForSize(12)).toThrow(DrawParamsError);
    expect(() => roundCountForSize(1)).toThrow(DrawParamsError);
  });

  it('pairs round-1 positions', () => {
    expect(partnerPosition(1)).toBe(2);
    expect(partnerPosition(2)).toBe(1);
    expect(partnerPosition(7)).toBe(8);
    expect(partnerPosition(8)).toBe(7);
  });
});

describe('splitEvenly', () => {
  it('differs by at most one and sums to the total', () => {
    expect(splitEvenly(40, 8)).toEqual([5, 5, 5, 5, 5, 5, 5, 5]);
    expect(splitEvenly(40, 6)).toEqual([7, 7, 7, 7, 6, 6]);
    expect(splitEvenly(2, 3)).toEqual([1, 1, 0]);
  });

  it('rejects invalid input', () => {
    expect(() => splitEvenly(5, 0)).toThrow(DrawParamsError);
    expect(() => splitEvenly(-1, 2)).toThrow(DrawParamsError);
  });
});

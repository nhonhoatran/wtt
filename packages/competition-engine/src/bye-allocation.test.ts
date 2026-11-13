import { describe, expect, it } from 'vitest';
import { partnerPosition } from './bracket-size.js';
import { allocateByePositions } from './bye-allocation.js';
import { createRng } from './seeded-random.js';
import { DrawParamsError } from './types.js';

const noBye2 = (byes: Set<number>) => [...byes].every((p) => !byes.has(partnerPosition(p)));

describe('allocateByePositions', () => {
  it('gives BYEs to the opponents of the best seeds first', () => {
    const byes = allocateByePositions({
      size: 16,
      byeCount: 2,
      seedOrder: [1, 16, 8, 9],
      occupied: new Set([1, 16, 8, 9]),
      rng: createRng('a'),
    });
    expect([...byes].sort((a, b) => a - b)).toEqual([2, 15]);
  });

  it('spreads the remaining BYEs across both halves without BYE vs BYE', () => {
    for (let i = 0; i < 30; i++) {
      const byes = allocateByePositions({
        size: 32,
        byeCount: 10,
        seedOrder: [1, 32],
        occupied: new Set([1, 32]),
        rng: createRng(`s${i}`),
      });
      expect(byes.size).toBe(10);
      expect(noBye2(byes)).toBe(true);
      const top = [...byes].filter((p) => p <= 16).length;
      expect(Math.abs(top - (10 - top))).toBeLessThanOrEqual(1);
    }
  });

  it('skips a seed whose partner slot is taken', () => {
    const byes = allocateByePositions({
      size: 4,
      byeCount: 1,
      seedOrder: [1, 4, 2],
      occupied: new Set([1, 2, 4]),
      rng: createRng('t'),
    });
    expect([...byes]).toEqual([3]);
  });

  it('respects maxPerHalf', () => {
    const byes = allocateByePositions({
      size: 16,
      byeCount: 4,
      seedOrder: [1, 2, 3, 4],
      occupied: new Set([1, 2, 3, 4]),
      rng: createRng('m'),
      maxPerHalf: 2,
    });
    expect(byes.size).toBe(4);
    expect([...byes].filter((p) => p <= 8).length).toBe(2);
  });

  it('fails when BYEs cannot fit', () => {
    expect(() =>
      allocateByePositions({ size: 4, byeCount: 3, seedOrder: [], occupied: new Set(), rng: createRng('f') }),
    ).toThrow(DrawParamsError);
    expect(() =>
      allocateByePositions({
        size: 8,
        byeCount: 4,
        seedOrder: [],
        occupied: new Set(),
        rng: createRng('f'),
        maxPerHalf: 1,
      }),
    ).toThrow(DrawParamsError);
  });
});

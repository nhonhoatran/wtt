import { describe, expect, it } from 'vitest';
import { createRng } from './seeded-random.js';
import { DrawParamsError } from './types.js';

describe('createRng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng('draw-1');
    const b = createRng('draw-1');
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(Array.from({ length: 20 }, () => b.next()));
  });

  it('differs for different seeds', () => {
    expect(createRng('draw-1').next()).not.toBe(createRng('draw-2').next());
  });

  it('keeps values in [0, 1) and ints in range', () => {
    const rng = createRng('range');
    for (let i = 0; i < 500; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      const n = rng.int(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
  });

  it('rejects an invalid range', () => {
    const rng = createRng('x');
    expect(() => rng.int(0)).toThrow(DrawParamsError);
    expect(() => rng.int(1.5)).toThrow(DrawParamsError);
  });

  it('shuffles into a permutation without touching the input', () => {
    const input = Array.from({ length: 30 }, (_, i) => i);
    const shuffled = createRng('shuffle').shuffle(input);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(input);
    expect(shuffled).not.toEqual(input);
    expect(input[0]).toBe(0);
  });

  it('covers every outcome of a small range', () => {
    const rng = createRng('coverage');
    const seen = new Set(Array.from({ length: 200 }, () => rng.int(4)));
    expect(seen.size).toBe(4);
  });
});

import { describe, expect, it } from 'vitest';
import { seedPositions } from './seed-positions.js';
import { createRng } from './seeded-random.js';
import { DrawParamsError } from './types.js';

const section = (position: number, size: number, sections: number) => Math.floor((position - 1) / (size / sections));

describe('seedPositions', () => {
  it('puts seeds 1 and 2 at the two ends', () => {
    const map = seedPositions(64, 2, createRng('a'));
    expect(map.get(1)).toBe(1);
    expect(map.get(2)).toBe(64);
  });

  it('places 3-4 in different quarters from 1-2 and each other', () => {
    for (let i = 0; i < 20; i++) {
      const map = seedPositions(64, 4, createRng(`q${i}`));
      const quarters = [1, 2, 3, 4].map((s) => section(map.get(s) as number, 64, 4));
      expect(new Set(quarters).size).toBe(4);
      expect([map.get(3), map.get(4)].sort((a, b) => (a as number) - (b as number))).toEqual([32, 33]);
    }
  });

  it('places seeds 1-8 in eight different eighths and 1-16 in sixteen different sixteenths', () => {
    for (let i = 0; i < 20; i++) {
      const map = seedPositions(64, 16, createRng(`e${i}`));
      expect(new Set([...map.entries()].filter(([s]) => s <= 8).map(([, p]) => section(p, 64, 8))).size).toBe(8);
      expect(new Set([...map.values()].map((p) => section(p, 64, 16))).size).toBe(16);
      expect(new Set(map.values()).size).toBe(16);
    }
  });

  it('keeps 1 and 2 in opposite halves', () => {
    const map = seedPositions(128, 32, createRng('h'));
    expect((map.get(1) as number) <= 64).toBe(true);
    expect((map.get(2) as number) > 64).toBe(true);
  });

  it('is deterministic per seed and varies across seeds', () => {
    const a = [...seedPositions(64, 16, createRng('same')).entries()];
    const b = [...seedPositions(64, 16, createRng('same')).entries()];
    expect(a).toEqual(b);
    const others = Array.from({ length: 5 }, (_, i) => JSON.stringify([...seedPositions(64, 16, createRng(`d${i}`))]));
    expect(new Set(others).size).toBeGreaterThan(1);
  });

  it('handles partial tiers, zero seeds and full seeding', () => {
    expect(seedPositions(16, 0, createRng('z')).size).toBe(0);
    expect(seedPositions(16, 1, createRng('z')).get(1)).toBe(1);
    expect(seedPositions(16, 6, createRng('z')).size).toBe(6);
    expect(new Set(seedPositions(8, 8, createRng('z')).values()).size).toBe(8);
    expect(seedPositions(2, 2, createRng('z')).get(2)).toBe(2);
  });

  it('rejects invalid sizes and seed counts', () => {
    expect(() => seedPositions(12, 2, createRng('x'))).toThrow(DrawParamsError);
    expect(() => seedPositions(8, 9, createRng('x'))).toThrow(DrawParamsError);
    expect(() => seedPositions(8, -1, createRng('x'))).toThrow(DrawParamsError);
  });
});

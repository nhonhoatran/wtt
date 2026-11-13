import { describe, expect, it } from 'vitest';
import { allocateGroups, groupCodes, groupSizes } from './group-allocation.js';
import { createRng } from './seeded-random.js';
import { DrawParamsError, type DrawEntry } from './types.js';

const entries = (count: number, seeded = 0): DrawEntry[] =>
  Array.from({ length: count }, (_, i) => ({ id: `E${i + 1}`, seed: i < seeded ? i + 1 : null, pointsAtEntry: 1000 - i }));

describe('allocateGroups', () => {
  it('puts pot 1 into groups A..G in order and keeps sizes within one', () => {
    const groups = allocateGroups({ entries: entries(14, 4), groupCount: 4, rng: createRng('g') });
    expect(groups.map((g) => g.code)).toEqual(['A', 'B', 'C', 'D']);
    expect(groups.map((g) => g.members[0]?.entryId)).toEqual(['E1', 'E2', 'E3', 'E4']);
    const sizes = groups.map((g) => g.members.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(14);
  });

  it('deals each later pot to distinct groups, one member per slot per group', () => {
    const groups = allocateGroups({ entries: entries(16, 0), groupCount: 4, rng: createRng('pots') });
    for (let slot = 1; slot <= 4; slot++) {
      const holders = groups.map((g) => g.members.filter((m) => m.slot === slot).length);
      expect(holders).toEqual([1, 1, 1, 1]);
    }
    const all = groups.flatMap((g) => g.members.map((m) => m.entryId));
    expect(new Set(all).size).toBe(16);
  });

  it('sorts by seed, then by points at entry, unseeded last', () => {
    const list: DrawEntry[] = [
      { id: 'low', seed: null, pointsAtEntry: 10 },
      { id: 'high', seed: null, pointsAtEntry: 99 },
      { id: 'second', seed: 2 },
      { id: 'first', seed: 1 },
      { id: 'nopoints', seed: null },
      { id: 'x', seed: null, pointsAtEntry: 5 },
    ];
    const [a, b] = allocateGroups({ entries: list, groupCount: 2, rng: createRng('s') });
    expect(a?.members[0]?.entryId).toBe('first');
    expect(b?.members[0]?.entryId).toBe('second');
    const pot2 = [a, b].map((g) => g?.members[1]?.entryId).sort();
    expect(pot2).toEqual(['high', 'low']);
  });

  it('is deterministic for a seed', () => {
    const run = (key: string) => allocateGroups({ entries: entries(24), groupCount: 6, rng: createRng(key) });
    expect(run('a')).toEqual(run('a'));
    expect(run('a')).not.toEqual(run('b'));
  });

  it('rejects too many groups, tiny groups and bad counts', () => {
    expect(() => allocateGroups({ entries: entries(8), groupCount: 3, rng: createRng('x') })).toThrow(DrawParamsError);
    expect(() => allocateGroups({ entries: entries(8), groupCount: 0, rng: createRng('x') })).toThrow(DrawParamsError);
    expect(() => groupCodes(27)).toThrow(DrawParamsError);
    expect(groupSizes(7, 2)).toEqual([4, 3]);
  });
});

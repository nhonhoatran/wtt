import { describe, expect, it } from 'vitest';
import { deriveMatches } from './derive-matches.js';
import { fillGroupPlaces, fillQualifierSlots } from './fill-placeholder-positions.js';
import { createRng } from './seeded-random.js';
import { DrawParamsError, type BracketPositionData } from './types.js';

const q = (position: number, index: number): BracketPositionData => ({ section: 1, position, source: 'QUALIFIER', sourceRef: { type: 'QUALIFIER', index } });
const e = (position: number): BracketPositionData => ({ section: 1, position, source: 'ENTRY', entryId: `E${position}` });
const g = (position: number, group: string, place: number): BracketPositionData => ({ section: 1, position, source: 'GROUP_PLACE', sourceRef: { type: 'GROUP_PLACE', group, place } });

describe('fillQualifierSlots', () => {
  const positions = [e(1), q(2, 1), e(3), q(4, 2)];

  it('seats every qualifier in a Q slot, deterministically per seed', () => {
    const a = fillQualifierSlots(positions, ['X', 'Y'], createRng('s'));
    expect(a.map((p) => p.entryId)).toEqual(expect.arrayContaining(['X', 'Y']));
    expect(a.every((p) => p.source === 'ENTRY')).toBe(true);
    expect(fillQualifierSlots(positions, ['X', 'Y'], createRng('s'))).toEqual(a);
    const orders = new Set(Array.from({ length: 10 }, (_, i) => fillQualifierSlots(positions, ['X', 'Y'], createRng(`r${i}`))[1]?.entryId));
    expect(orders.size).toBe(2);
    expect(() => deriveMatches({ positions: a, size: 4, scopeKey: 'S1', section: 1 })).not.toThrow();
  });

  it('rejects a qualifier count that does not match the slots', () => {
    expect(() => fillQualifierSlots(positions, ['X'], createRng('s'))).toThrow(DrawParamsError);
  });
});

describe('fillGroupPlaces', () => {
  const positions = [g(1, 'A', 1), g(2, 'B', 2), e(3), e(4)];

  it('replaces group places with the entries that earned them', () => {
    const filled = fillGroupPlaces(positions, new Map([['A:1', 'Ann'], ['B:2', 'Bob']]));
    expect(filled.map((p) => p.entryId)).toEqual(['Ann', 'Bob', 'E3', 'E4']);
    expect(filled[0]?.sourceRef).toEqual({ type: 'GROUP_PLACE', group: 'A', place: 1 });
  });

  it('fails when a place has no entry yet', () => {
    expect(() => fillGroupPlaces(positions, new Map([['A:1', 'Ann']]))).toThrow(DrawParamsError);
  });
});

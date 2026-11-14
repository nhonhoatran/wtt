import { describe, expect, it } from 'vitest';
import { addDays } from './date-math.js';
import { pointsForEntry } from './points-for-entry.js';
import { ruleFor } from './rule-for-date.js';
import type { PointsRule } from './types.js';

function rule(over: Partial<PointsRule>): PointsRule {
  return {
    eventTypeId: 'et1',
    competitorKind: 'SINGLES',
    drawKind: 'MAIN',
    stageCode: 'W',
    points: 1000,
    effectiveFrom: '2026-01-01',
    ...over,
  };
}

const query = { eventTypeId: 'et1', competitorKind: 'SINGLES', drawKind: 'MAIN', stageCode: 'W', endDate: '2026-06-30' } as const;

describe('ruleFor', () => {
  it('picks the newest version not after the event end date', () => {
    const rules = [rule({}), rule({ points: 1200, effectiveFrom: '2026-06-30' }), rule({ points: 1500, effectiveFrom: '2026-07-01' })];
    expect(ruleFor(rules, query)?.points).toBe(1200);
    expect(ruleFor(rules, { ...query, endDate: '2026-03-01' })?.points).toBe(1000);
  });

  it('keeps the first when versions come in any order', () => {
    const rules = [rule({ points: 1200, effectiveFrom: '2026-05-01' }), rule({})];
    expect(ruleFor(rules, query)?.points).toBe(1200);
  });

  it('returns null when no cell matches', () => {
    expect(ruleFor([rule({})], { ...query, endDate: '2025-12-31' })).toBeNull();
    expect(ruleFor([rule({})], { ...query, stageCode: 'F' })).toBeNull();
    expect(ruleFor([rule({})], { ...query, eventTypeId: 'x' })).toBeNull();
    expect(ruleFor([rule({})], { ...query, competitorKind: 'DOUBLES' })).toBeNull();
    expect(ruleFor([rule({})], { ...query, drawKind: 'GROUP' })).toBeNull();
  });
});

describe('addDays', () => {
  it('adds across month and leap-year boundaries', () => {
    expect(addDays('2026-06-30', 365)).toBe('2027-06-30');
    expect(addDays('2027-12-31', 60)).toBe('2028-02-29');
  });

  it('rejects an invalid date', () => {
    expect(() => addDays('nope', 1)).toThrow(RangeError);
  });
});

describe('pointsForEntry', () => {
  const base = {
    entryId: 'e1',
    playerIds: ['p1'],
    stage: { drawKind: 'MAIN', stageCode: 'W' },
    rules: [rule({})],
    eventTypeId: 'et1',
    competitorKind: 'SINGLES',
    endDate: '2026-06-30',
    validityDays: 365,
  } as const;

  it('writes one frozen ledger row for singles', () => {
    expect(pointsForEntry({ ...base, playerIds: ['p1'] })).toEqual([
      {
        playerId: 'p1',
        entryId: 'e1',
        stageCode: 'W',
        points: 1000,
        ruleEffectiveFrom: '2026-01-01',
        earnedAt: '2026-06-30',
        expiresAt: '2027-06-30',
      },
    ]);
  });

  it('writes one row per player for a pair', () => {
    const rows = pointsForEntry({ ...base, playerIds: ['p1', 'p2'] });
    expect(rows.map((r) => r.playerId)).toEqual(['p1', 'p2']);
    expect(rows.every((r) => r.points === 1000)).toBe(true);
  });

  it('writes nothing without stage, rule or points', () => {
    expect(pointsForEntry({ ...base, stage: null })).toEqual([]);
    expect(pointsForEntry({ ...base, rules: [] })).toEqual([]);
    expect(pointsForEntry({ ...base, rules: [rule({ points: 0 })] })).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { competitionRank } from './competition-rank.js';
import { seedValueForEntry } from './pair-seed-points.js';
import { buildSnapshotRows } from './snapshot-builder.js';
import { stageCodeRows } from './stage-code-rows.js';
import type { LedgerRowInput } from './types.js';

function ledger(over: Partial<LedgerRowInput> & { id: string; playerId: string }): LedgerRowInput {
  return {
    points: 100,
    stageCode: 'W',
    earnedAt: '2026-01-10',
    expiresAt: '2027-01-10',
    eventId: 'event-a',
    eventSlug: 'ev',
    eventName: 'Giai',
    eventNameEn: 'Event',
    eventTypeCode: 'A',
    ...over,
  };
}

describe('competitionRank', () => {
  it('ranks equal totals the same and skips the next rank', () => {
    const ranked = competitionRank([
      { playerId: 'a', total: 300, counted: 1, fullName: 'A' },
      { playerId: 'b', total: 200, counted: 1, fullName: 'B' },
      { playerId: 'c', total: 200, counted: 1, fullName: 'C' },
      { playerId: 'd', total: 100, counted: 1, fullName: 'D' },
    ]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it('orders ties by fewer counted results then name', () => {
    const ranked = competitionRank([
      { playerId: 'x', total: 100, counted: 2, fullName: 'An' },
      { playerId: 'y', total: 100, counted: 1, fullName: 'Zed' },
      { playerId: 'z', total: 100, counted: 1, fullName: 'Bao' },
    ]);
    expect(ranked.map((r) => r.playerId)).toEqual(['z', 'y', 'x']);
  });

  it('handles an empty list', () => {
    expect(competitionRank([])).toEqual([]);
  });
});

describe('buildSnapshotRows', () => {
  const names = new Map([['p1', 'An'], ['p2', 'Binh']]);

  it('sums valid rows with breakdown and drops expired or future rows', () => {
    const rows = buildSnapshotRows({
      ledger: [
        ledger({ id: 'l1', playerId: 'p1', points: 400 }),
        ledger({ id: 'l2', playerId: 'p1', points: 125, earnedAt: '2025-01-01', expiresAt: '2026-06-01' }),
        ledger({ id: 'l3', playerId: 'p1', points: 50, earnedAt: '2026-09-01', expiresAt: '2027-09-01' }),
        ledger({ id: 'l4', playerId: 'p2', points: 200 }),
      ],
      asOf: '2026-07-01',
      playerNames: names,
      previousRanks: new Map(),
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ playerId: 'p1', points: 400, resultsCounted: 1, rank: 1 });
    expect(rows[0]!.breakdown.map((b) => b.ledgerId)).toEqual(['l1']);
    expect(rows[0]!.breakdown[0]!.eventId).toBe('event-a');
  });

  it('treats expiresAt as exclusive and earnedAt as inclusive', () => {
    const base = { ledger: [ledger({ id: 'l1', playerId: 'p1' })], playerNames: names, previousRanks: new Map<string, number>() };
    expect(buildSnapshotRows({ ...base, asOf: '2026-01-10' })).toHaveLength(1);
    expect(buildSnapshotRows({ ...base, asOf: '2027-01-10' })).toHaveLength(0);
  });

  it('computes previousRank and movement, null for new players', () => {
    const rows = buildSnapshotRows({
      ledger: [
        ledger({ id: 'l1', playerId: 'p1', points: 500 }),
        ledger({ id: 'l2', playerId: 'p2', points: 300 }),
        ledger({ id: 'l3', playerId: 'p3', points: 100 }),
      ],
      asOf: '2026-07-01',
      playerNames: names,
      previousRanks: new Map([['p1', 3], ['p2', 1]]),
    });
    const byId = Object.fromEntries(rows.map((r) => [r.playerId, r]));
    expect(byId.p1).toMatchObject({ rank: 1, previousRank: 3, movement: 2 });
    expect(byId.p2).toMatchObject({ rank: 2, previousRank: 1, movement: -1 });
    expect(byId.p3).toMatchObject({ rank: 3, previousRank: null, movement: null });
  });

  it('lists the biggest breakdown items first', () => {
    const rows = buildSnapshotRows({
      ledger: [ledger({ id: 'small', playerId: 'p1', points: 10 }), ledger({ id: 'big', playerId: 'p1', points: 90 })],
      asOf: '2026-07-01',
      playerNames: names,
      previousRanks: new Map(),
    });
    expect(rows[0]!.breakdown.map((b) => b.ledgerId)).toEqual(['big', 'small']);
  });
});

describe('seedValueForEntry', () => {
  const rows = new Map([['a', { rank: 5, points: 300 }]]);

  it('sums a pair with an unranked partner and leaves rank empty', () => {
    expect(seedValueForEntry(['a', 'b'], rows)).toEqual({ rankingAtEntry: null, pointsAtEntry: 300 });
  });

  it('keeps rank and points for singles, zero when unranked', () => {
    expect(seedValueForEntry(['a'], rows)).toEqual({ rankingAtEntry: 5, pointsAtEntry: 300 });
    expect(seedValueForEntry(['b'], rows)).toEqual({ rankingAtEntry: null, pointsAtEntry: 0 });
  });
});

describe('stageCodeRows', () => {
  it('returns the standard frames', () => {
    expect(stageCodeRows('MAIN', [])).toEqual(['W', 'F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128']);
    expect(stageCodeRows('QUALIFYING', [])).toEqual(['QF-1', 'QF-2', 'QF-3', 'QF-4']);
    expect(stageCodeRows('GROUP', [])).toHaveLength(9);
  });

  it('appends stored codes outside the frame in numeric order without duplicates', () => {
    expect(stageCodeRows('MAIN', ['R16', 'R256', 'R512', 'R256', 'ZZ'])).toEqual([
      'W', 'F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128', 'ZZ', 'R256', 'R512',
    ]);
    expect(stageCodeRows('QUALIFYING', ['QF-5', 'QF-1'])).toContain('QF-5');
  });
});

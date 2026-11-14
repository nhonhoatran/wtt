import { describe, expect, it } from 'vitest';
import { computeScheduleConflicts, type ConflictSideInput } from './schedule-conflict.js';

const at = (hhmm: string) => new Date(`2026-11-20T${hhmm}:00Z`);
const alice = { id: 'p-alice', name: 'Alice' };
const bob = { id: 'p-bob', name: 'Bob' };
const carol = { id: 'p-carol', name: 'Carol' };

const match = (id: number, start: string, table: string, players: ConflictSideInput['players'], durationMinutes = 30): ConflictSideInput => ({
  matchId: `m${id}`,
  matchNo: id,
  tableId: table,
  startsAt: at(start),
  durationMinutes,
  players,
});

describe('computeScheduleConflicts', () => {
  it('flags a player whose two matches overlap on different tables', () => {
    const out = computeScheduleConflicts([match(1, '09:00', 't1', [alice, bob]), match(2, '09:10', 't2', [alice, carol])], 20);
    expect(out.get('m1')).toEqual([expect.objectContaining({ kind: 'PLAYER_OVERLAP', playerId: 'p-alice', withMatchNo: 2, gapMinutes: -20 })]);
    expect(out.get('m2')).toHaveLength(1);
  });

  it('flags insufficient rest and accepts exactly the minimum', () => {
    const tight = computeScheduleConflicts([match(1, '09:00', 't1', [alice]), match(2, '09:40', 't2', [alice])], 20);
    expect(tight.get('m1')).toEqual([expect.objectContaining({ gapMinutes: 10 })]);
    const enough = computeScheduleConflicts([match(1, '09:00', 't1', [alice]), match(2, '09:50', 't2', [alice])], 20);
    expect(enough.size).toBe(0);
  });

  it('matches a player inside a pair by player id', () => {
    const out = computeScheduleConflicts([match(1, '09:00', 't1', [alice, bob]), match(2, '09:00', 't2', [bob, carol])], 0);
    expect(out.get('m1')).toEqual([expect.objectContaining({ playerId: 'p-bob' })]);
  });

  it('flags two matches overlapping on one table but not back-to-back ones', () => {
    const overlap = computeScheduleConflicts([match(1, '09:00', 't1', [alice]), match(2, '09:20', 't1', [bob])], 20);
    expect(overlap.get('m1')).toEqual([{ kind: 'TABLE_OVERLAP', withMatchId: 'm2', withMatchNo: 2, tableId: 't1' }]);
    const backToBack = computeScheduleConflicts([match(1, '09:00', 't1', [alice]), match(2, '09:30', 't1', [bob])], 20);
    expect(backToBack.size).toBe(0);
  });

  it('reports nothing for unrelated matches', () => {
    expect(computeScheduleConflicts([match(1, '09:00', 't1', [alice]), match(2, '09:00', 't2', [bob])], 20).size).toBe(0);
  });
});

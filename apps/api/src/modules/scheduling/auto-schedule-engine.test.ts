import { describe, expect, it } from 'vitest';
import { planAutoSchedule } from './auto-schedule-engine.js';
import type { AutoMatch, AutoSession } from './auto-schedule-types.js';

const MINUTE = 60_000;
const player = (id: string) => ({ id, name: id });
const side = (...ids: string[]) => ({ players: ids.map(player), feederNo: null });
const feeder = (no: number) => ({ players: [], feederNo: no });
const session = (id = 's1', start = 0, end = 240 * MINUTE, tableIds = ['t1', 't2']): AutoSession => ({ id, code: id, start, end, tables: tableIds.map((id, order) => ({ id, code: id, order })) });
const match = (no: number, patch: Partial<AutoMatch> = {}): AutoMatch => ({
  id: `m${no}`, matchNo: no, round: 1, status: 'SCHEDULED', resultType: null, isVoided: false, published: true,
  winnerSide: null, nextMatchId: null, sessionId: null, tableId: null, orderInSession: null, scheduledAt: null, startedAt: null, officialAt: null,
  durationMinutes: 30, sides: [side(`p${no}a`), side(`p${no}b`)], ...patch,
});
const plan = (matches: AutoMatch[], sessions = [session()], rest = 20, cap = 500) => planAutoSchedule(matches, sessions, rest, cap);

describe('deterministic append-only automatic scheduling', () => {
  it('is deterministic with differently ordered source arrays and respects table order', () => {
    const a = plan([match(3), match(1), match(2)]);
    expect(a).toEqual(plan([match(2), match(3), match(1)]));
    expect(a.assignments.map((a) => [a.matchNo, a.tableId, a.orderInSession])).toEqual([[1, 't1', 1], [2, 't2', 1], [3, 't1', 2]]);
  });

  it('preserves existing slots/times and appends after live reservations', () => {
    const existing = match(1, { status: 'LIVE', sessionId: 's1', tableId: 't1', orderInSession: 4, scheduledAt: 60 * MINUTE });
    const before = structuredClone(existing);
    const result = plan([existing, match(2)], [session('s1', 0, 180 * MINUTE, ['t1'])]);
    expect(result.assignments[0]).toMatchObject({ matchNo: 2, orderInSession: 5, scheduledAt: new Date(90 * MINUTE).toISOString() });
    expect(existing).toEqual(before);
  });

  it('prevents a singles player overlapping with either doubles partner and honors exact rest boundary', () => {
    const previous = match(1, { sessionId: 'other', tableId: 'otherTable', orderInSession: 1, scheduledAt: 0, sides: [side('shared'), side('other')] });
    const doubles = match(2, { sides: [side('partner', 'shared'), side('opponent1', 'opponent2')] });
    expect(plan([previous, doubles], [session('s1', 49 * MINUTE)]).assignments).toHaveLength(0);
    expect(plan([previous, doubles], [session('s1', 50 * MINUTE)]).assignments).toHaveLength(1);
  });

  it('reserves the losing player of an official match too', () => {
    const previous = match(1, { status: 'OFFICIAL', winnerSide: 1, sessionId: 'other', tableId: 'otherTable', scheduledAt: 0, sides: [side('winner'), side('loser')] });
    expect(plan([previous, match(2, { sides: [side('loser'), side('other')] })], [session('s1', 30 * MINUTE)]).assignments).toHaveLength(0);
  });

  it('blocks a player in an unscheduled live match and respects unscheduled official finish time', () => {
    const current = match(1, { status: 'LIVE', startedAt: 0, sides: [side('shared'), side('other')] });
    const next = match(2, { sides: [side('shared'), side('new')] });
    expect(plan([current, next]).assignments).toHaveLength(0);
    const official = { ...current, status: 'OFFICIAL', officialAt: 45 * MINUTE };
    expect(plan([official, next], [session('s1', 64 * MINUTE)]).assignments).toHaveLength(0);
    expect(plan([official, next], [session('s1', 65 * MINUTE)]).assignments).toHaveLength(1);
  });

  it('waits for both feeders and every possible winner, using other matches to fill the rest interval', () => {
    const matches = [match(1), match(2), match(3), match(4, { round: 2, sides: [feeder(1), feeder(2)] })];
    const result = plan(matches, [session('s1', 0, 240 * MINUTE, ['t1'])]);
    expect(result.assignments.map((a) => [a.matchNo, a.scheduledAt])).toEqual([1, 2, 3, 4].map((no, index) => [no, new Date(index * 30 * MINUTE).toISOString()]));
  });

  it('does not invent an idle gap when a feeder needs rest', () => {
    const result = plan([match(1), match(2, { round: 2, sides: [feeder(1), side('p3')] })], [session('s1', 0, 240 * MINUTE, ['t1'])]);
    expect(result.assignments.map((a) => a.matchNo)).toEqual([1]);
    expect(result.skipped[0]?.reason).toBe('NO_COMPATIBLE_SLOT');
  });

  it('skips unresolved qualifier/group places and unscheduled dependencies explicitly', () => {
    const result = plan([match(1, { sides: [side(), side('known')] }), match(2, { round: 2, sides: [feeder(1), side('known2')] }), match(3, { round: 2, sides: [feeder(99), side('known3')] })]);
    expect(result.assignments).toEqual([]);
    expect(result.skipped.every((s) => s.reason === 'UNRESOLVED_PLAYERS')).toBe(true);
    const blocked = plan([match(1, { published: false }), match(2, { sides: [feeder(1), side('known')] })]);
    expect(blocked.skipped).toMatchObject([{ matchNo: 2, reason: 'DEPENDENCY_NOT_SCHEDULED' }]);
  });

  it('enforces end times and session cap while excluding BYE, walkover, void, live and draft candidates', () => {
    expect(plan([match(1)], [session('s1', 0, 29 * MINUTE)]).assignments).toHaveLength(0);
    expect(plan([match(1)], [session('s1', 0, 30 * MINUTE)]).assignments).toHaveLength(1);
    expect(plan([match(1), match(2)], [session()], 20, 1).assignments).toHaveLength(1);
    expect(plan([match(1, { resultType: 'BYE' }), match(2, { resultType: 'WALKOVER' }), match(3, { isVoided: true }), match(4, { status: 'LIVE' }), match(5, { published: false })]).assignments).toEqual([]);
  });

  it('avoids reusing a physical table across overlapping sessions', () => {
    const result = plan([match(1), match(2)], [session('s1', 0, 30 * MINUTE, ['t1']), session('s2', 0, 30 * MINUTE, ['t1'])]);
    expect(result.assignments).toHaveLength(1);
  });

  it('follows reverse next-match dependencies after sources were cleared', () => {
    const result = plan([match(1, { nextMatchId: 'm2' }), match(2, { round: 2 })], [session('s1', 0, 240 * MINUTE, ['t1'])]);
    expect(result.assignments.map((a) => a.matchNo)).toEqual([1]);
  });

  it('flattens BYE feeders without assigning fake playing duration', () => {
    const bye = match(1, { status: 'OFFICIAL', resultType: 'BYE', winnerSide: 1, nextMatchId: 'm2', sides: [side('p1'), side()] });
    const result = plan([bye, match(2, { round: 2, sides: [feeder(1), side('p2')] })]);
    expect(result.assignments).toMatchObject([{ matchNo: 2, scheduledAt: new Date(0).toISOString() }]);
  });
});

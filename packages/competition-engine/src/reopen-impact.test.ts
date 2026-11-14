import { describe, expect, it } from 'vitest';
import { computeReopenImpact, type ImpactMatch, type ImpactSeat } from './reopen-impact.js';

let counter = 0;
const match = (id: string, over: Partial<ImpactMatch> = {}): ImpactMatch => ({
  id,
  matchNo: ++counter,
  status: 'SCHEDULED',
  resultType: null,
  winnerSide: null,
  officialById: 'u1',
  side1EntryId: null,
  side2EntryId: null,
  nextMatchId: null,
  nextMatchSide: null,
  ...over,
});
const official = (id: string, over: Partial<ImpactMatch> = {}) => match(id, { status: 'OFFICIAL', resultType: 'NORMAL', winnerSide: 1, ...over });

describe('computeReopenImpact', () => {
  it('lists the next match as removable when it has not been played', () => {
    const impact = computeReopenImpact({
      rootId: 'r1',
      rootIsGroupMatch: false,
      seats: [],
      matches: [official('r1', { side1EntryId: 'A', side2EntryId: 'B', nextMatchId: 'sf', nextMatchSide: 2 }), match('sf', { side1EntryId: 'C', side2EntryId: 'A' })],
    });
    expect(impact.blocking).toEqual([]);
    expect(impact.affected).toMatchObject([{ matchId: 'sf', side: 2, entryId: 'A', effect: 'CLEAR_SIDE', fromMatchId: 'r1' }]);
  });

  it('blocks on a played next match and keeps following the chain', () => {
    const impact = computeReopenImpact({
      rootId: 'r1',
      rootIsGroupMatch: false,
      seats: [],
      matches: [
        official('r1', { side1EntryId: 'A', side2EntryId: 'B', nextMatchId: 'sf', nextMatchSide: 1 }),
        official('sf', { side1EntryId: 'A', side2EntryId: 'C', winnerSide: 2, nextMatchId: 'f', nextMatchSide: 1 }),
        match('f', { side1EntryId: 'C', side2EntryId: 'D' }),
      ],
    });
    expect(impact.blocking.map((c) => c.matchId)).toEqual(['sf']);
    expect(impact.affected.map((c) => [c.matchId, c.entryId])).toEqual([['f', 'C']]);
  });

  it('treats a LIVE next match as blocking', () => {
    const impact = computeReopenImpact({
      rootId: 'r1',
      rootIsGroupMatch: false,
      seats: [],
      matches: [official('r1', { side1EntryId: 'A', side2EntryId: 'B', nextMatchId: 'sf', nextMatchSide: 1 }), match('sf', { status: 'LIVE', side1EntryId: 'A', side2EntryId: 'C' })],
    });
    expect(impact.blocking).toMatchObject([{ matchId: 'sf', status: 'LIVE', effect: 'RESET_RESULT' }]);
  });

  it('reverts a settled walkover without blocking and pulls the winner back out of the match after it', () => {
    const impact = computeReopenImpact({
      rootId: 'r1',
      rootIsGroupMatch: false,
      seats: [],
      matches: [
        official('r1', { side1EntryId: 'A', side2EntryId: 'B', nextMatchId: 'w', nextMatchSide: 1 }),
        official('w', { resultType: 'WALKOVER', officialById: null, side1EntryId: 'A', side2EntryId: 'GONE', nextMatchId: 'f', nextMatchSide: 2 }),
        match('f', { side1EntryId: 'X', side2EntryId: 'A' }),
      ],
    });
    expect(impact.blocking).toEqual([]);
    expect(impact.affected.map((c) => [c.matchId, c.effect])).toEqual([
      ['w', 'REVERT_AUTO'],
      ['f', 'CLEAR_SIDE'],
    ]);
  });

  it('flags the walkover of a withdrawn winner so the marker is dropped, and still pulls the opponent out of the next match', () => {
    const impact = computeReopenImpact({
      rootId: 'r1',
      rootIsGroupMatch: false,
      seats: [],
      matches: [
        official('r1', { side1EntryId: 'A', side2EntryId: 'B', nextMatchId: 'n', nextMatchSide: 1 }),
        official('n', { resultType: 'WALKOVER', officialById: null, winnerSide: 2, side1EntryId: 'A', side2EntryId: 'O', nextMatchId: 'f', nextMatchSide: 1 }),
        match('f', { side1EntryId: 'O' }),
      ],
    });
    expect(impact.affected.map((c) => [c.matchId, c.walkoverLoser])).toEqual([
      ['n', true],
      ['f', false],
    ]);
  });

  it('flags a pending walkover marker whose loser leaves while the winner slot is still empty', () => {
    const impact = computeReopenImpact({
      rootId: 'r1',
      rootIsGroupMatch: false,
      seats: [],
      matches: [official('r1', { side1EntryId: 'A', side2EntryId: 'B', nextMatchId: 'n', nextMatchSide: 1 }), match('n', { resultType: 'WALKOVER', winnerSide: 2, side1EntryId: 'A' })],
    });
    expect(impact.affected).toMatchObject([{ matchId: 'n', effect: 'CLEAR_SIDE', walkoverLoser: true }]);
  });

  it('does not flag a settled walkover won by the leaving entry', () => {
    const impact = computeReopenImpact({
      rootId: 'r1',
      rootIsGroupMatch: false,
      seats: [],
      matches: [official('r1', { side1EntryId: 'A', side2EntryId: 'B', nextMatchId: 'w', nextMatchSide: 1 }), official('w', { resultType: 'WALKOVER', officialById: null, side1EntryId: 'A', side2EntryId: 'GONE' })],
    });
    expect(impact.affected).toMatchObject([{ matchId: 'w', effect: 'REVERT_AUTO', walkoverLoser: false }]);
  });

  it('does not treat an operator-confirmed walkover as automatic', () => {
    const impact = computeReopenImpact({
      rootId: 'r1',
      rootIsGroupMatch: false,
      seats: [],
      matches: [
        official('r1', { side1EntryId: 'A', side2EntryId: 'B', nextMatchId: 'w', nextMatchSide: 1 }),
        official('w', { resultType: 'WALKOVER', officialById: 'u2', side1EntryId: 'A', side2EntryId: 'C' }),
      ],
    });
    expect(impact.blocking.map((c) => c.matchId)).toEqual(['w']);
  });

  it('skips a next match that never received the winner', () => {
    const impact = computeReopenImpact({
      rootId: 'r1',
      rootIsGroupMatch: false,
      seats: [],
      matches: [official('r1', { side1EntryId: 'A', side2EntryId: 'B', nextMatchId: 'sf', nextMatchSide: 1 }), match('sf')],
    });
    expect(impact.cells).toEqual([]);
  });

  const seat: ImpactSeat = { entryId: 'Q1', matchId: 'm1', side: 2, positionId: 'p', ref: { type: 'QUALIFIER', index: 1 } };

  it('removes the qualifier slot when a section final is reopened', () => {
    const impact = computeReopenImpact({
      rootId: 'qf',
      rootIsGroupMatch: false,
      seats: [seat],
      matches: [official('qf', { side1EntryId: 'Q1', side2EntryId: 'Z' }), match('m1', { side1EntryId: 'S', side2EntryId: 'Q1' })],
    });
    expect(impact.affected).toMatchObject([{ matchId: 'm1', side: 2, entryId: 'Q1', fromMatchId: null, seat }]);
  });

  it('follows a qualifier through a BYE first-round match', () => {
    const impact = computeReopenImpact({
      rootId: 'qf',
      rootIsGroupMatch: false,
      seats: [seat],
      matches: [
        official('qf', { side1EntryId: 'Q1', side2EntryId: 'Z' }),
        official('m1', { resultType: 'BYE', winnerSide: 2, side2EntryId: 'Q1', nextMatchId: 'm2', nextMatchSide: 1 }),
        match('m2', { side1EntryId: 'Q1', side2EntryId: 'Y' }),
      ],
    });
    expect(impact.affected.map((c) => [c.matchId, c.effect])).toEqual([
      ['m1', 'REVERT_AUTO'],
      ['m2', 'CLEAR_SIDE'],
    ]);
  });

  it('ignores the seat when the section final was won by the other side', () => {
    const impact = computeReopenImpact({
      rootId: 'qf',
      rootIsGroupMatch: false,
      seats: [seat],
      matches: [official('qf', { winnerSide: 2, side1EntryId: 'Q1', side2EntryId: 'Z' }), match('m1', { side2EntryId: 'Q1' })],
    });
    expect(impact.cells).toEqual([]);
  });

  it('removes every seated group place when a group match is reopened', () => {
    const seats: ImpactSeat[] = [
      { entryId: 'G1', matchId: 'm1', side: 1, positionId: 'p1', ref: { type: 'GROUP_PLACE', group: 'A', place: 1 } },
      { entryId: 'G2', matchId: 'm2', side: 2, positionId: 'p2', ref: { type: 'GROUP_PLACE', group: 'A', place: 2 } },
    ];
    const impact = computeReopenImpact({
      rootId: 'g',
      rootIsGroupMatch: true,
      seats,
      matches: [official('g', { side1EntryId: 'G1', side2EntryId: 'G2' }), match('m1', { side1EntryId: 'G1' }), official('m2', { side2EntryId: 'G2', side1EntryId: 'H' })],
    });
    expect(impact.affected.map((c) => c.matchId)).toEqual(['m1']);
    expect(impact.blocking.map((c) => c.matchId)).toEqual(['m2']);
  });

  it('throws for a root outside the snapshot', () => {
    expect(() => computeReopenImpact({ rootId: 'x', rootIsGroupMatch: false, seats: [], matches: [] })).toThrow();
  });
});

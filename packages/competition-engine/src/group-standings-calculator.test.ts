import type { TiebreakCriterion } from '@kamito/shared';
import { describe, expect, it } from 'vitest';
import { calculateGroupStandings } from './group-standings-calculator.js';
import type { GroupMatchInput, GroupScoringRuleInput, MatchFormatInput } from './group-match-scoring.js';
import { DrawParamsError } from './types.js';

const format: MatchFormatInput = { bestOf: 5, pointsPerGame: 11 };
const makeRule = (tiebreakers: TiebreakCriterion[], over: Partial<GroupScoringRuleInput> = {}): GroupScoringRuleInput => ({
  pointsWin: 2,
  pointsLoss: 1,
  pointsWalkoverLoss: 0,
  pointsUnfinishedLoss: 0,
  unfinishedMatchScoring: 'COUNT_PLAYED_ONLY',
  awardedGamePoints: null,
  tiebreakers,
  ...over,
});
const DEFAULT_ORDER: TiebreakCriterion[] = [
  'HEAD_TO_HEAD_POINTS',
  'HEAD_TO_HEAD_GAME_RATIO',
  'HEAD_TO_HEAD_POINT_RATIO',
  'GAME_RATIO',
  'POINT_RATIO',
];

/** Winner takes games 3-0 with 11-5 each unless explicit scores are given. */
function win(winner: string, loser: string, scores: [number, number][] = [[11, 5], [11, 5], [11, 5]], over: Partial<GroupMatchInput> = {}): GroupMatchInput {
  const winnerFirst = winner < loser;
  return {
    side1EntryId: winnerFirst ? winner : loser,
    side2EntryId: winnerFirst ? loser : winner,
    status: 'OFFICIAL',
    resultType: 'NORMAL',
    winnerSide: winnerFirst ? 1 : 2,
    games: scores.map(([w, l]) => (winnerFirst ? { score1: w, score2: l } : { score1: l, score2: w })),
    ...over,
  };
}
const run = (entryIds: string[], matches: GroupMatchInput[], rule = makeRule(DEFAULT_ORDER), extra: { advancePerGroup?: number; manualRanks?: Record<string, number>; withdrawnEntryIds?: string[] } = {}) =>
  calculateGroupStandings({ entryIds, matches, rule, format, advancePerGroup: extra.advancePerGroup ?? 2, ...(extra.manualRanks ? { manualRanks: extra.manualRanks } : {}), ...(extra.withdrawnEntryIds ? { withdrawnEntryIds: extra.withdrawnEntryIds } : {}) });
const order = (result: ReturnType<typeof run>) => result.rows.map((r) => r.entryId);

describe('basic table', () => {
  const matches = [win('A', 'B'), win('A', 'C'), win('A', 'D'), win('B', 'C'), win('B', 'D'), win('C', 'D')];
  const result = run(['A', 'B', 'C', 'D'], matches);

  it('ranks by match points and totals games/points', () => {
    expect(order(result)).toEqual(['A', 'B', 'C', 'D']);
    expect(result.rows[0]).toMatchObject({ played: 3, won: 3, lost: 0, matchPoints: 6, gamesFor: 9, gamesAgainst: 0, pointsFor: 99, pointsAgainst: 45, rank: 1 });
    expect(result.rows[3]).toMatchObject({ played: 3, won: 0, lost: 3, matchPoints: 3, rank: 4 });
  });

  it('marks the top advancePerGroup as qualified once complete', () => {
    expect(result.complete).toBe(true);
    expect(result.rows.map((r) => r.qualified)).toEqual([true, true, false, false]);
    expect(run(['A', 'B', 'C', 'D'], matches, makeRule(DEFAULT_ORDER), { advancePerGroup: 1 }).rows.map((r) => r.qualified)).toEqual([true, false, false, false]);
  });

  it('does not qualify anyone while a match is unfinished', () => {
    const open: GroupMatchInput = { side1EntryId: 'C', side2EntryId: 'D', status: 'LIVE', games: [] };
    const partial = run(['A', 'B', 'C', 'D'], [...matches.slice(0, 5), open]);
    expect(partial.complete).toBe(false);
    expect(partial.rows.every((r) => !r.qualified)).toBe(true);
  });

  it('is pure: same input, same output', () => {
    expect(run(['A', 'B', 'C', 'D'], matches)).toEqual(result);
  });

  it('rejects duplicate entries and matches from outside the group', () => {
    expect(() => run(['A', 'A'], [])).toThrow(DrawParamsError);
    expect(() => run(['A', 'B'], [win('A', 'Z')])).toThrow(DrawParamsError);
  });
});

describe('ties', () => {
  const ring = ['A', 'B', 'C', 'D'];
  const twoWayTies = (abWinner: 'A' | 'B') => [
    win(abWinner, abWinner === 'A' ? 'B' : 'A'),
    win('B', 'C'),
    win('C', 'D'),
    win('D', 'A'),
    win('A', 'C'),
    win('B', 'D'),
  ];

  it('breaks a two-way tie by head-to-head points', () => {
    expect(order(run(ring, twoWayTies('A')))).toEqual(['A', 'B', 'C', 'D']);
    const flipped = run(ring, [win('B', 'A'), win('B', 'C'), win('C', 'D'), win('D', 'A'), win('C', 'A'), win('B', 'D')]);
    expect(order(flipped).slice(0, 1)).toEqual(['B']);
  });

  const cycle = (aBeatsB: [number, number][], bBeatsC: [number, number][], cBeatsA: [number, number][]) => [
    win('A', 'B', aBeatsB),
    win('B', 'C', bBeatsC),
    win('C', 'A', cBeatsA),
  ];
  const games = (w: number[], l: number[]) => w.map((x, i): [number, number] => [x, l[i] as number]);
  const threeCycle = cycle(
    [[11, 0], [11, 0], [11, 0], [0, 11], [0, 11]],
    games([11, 11, 11], [9, 9, 9]),
    [[11, 9], [11, 9], [11, 9], [9, 11], [9, 11]],
  );

  it('splits a three-way cycle by game ratio, or by point ratio when the criteria order changes', () => {
    const byGames = run(['A', 'B', 'C'], threeCycle, makeRule(['GAME_RATIO', 'POINT_RATIO']));
    expect(order(byGames)).toEqual(['B', 'A', 'C']);
    const byPoints = run(['A', 'B', 'C'], threeCycle, makeRule(['POINT_RATIO', 'GAME_RATIO']));
    expect(order(byPoints)).toEqual(['A', 'C', 'B']);
    expect(byGames.rows.every((r) => !r.needsManualTiebreak)).toBe(true);
  });

  it('uses head-to-head criteria inside the tie set only', () => {
    const result = run(['A', 'B', 'C'], threeCycle, makeRule(['HEAD_TO_HEAD_POINTS', 'HEAD_TO_HEAD_GAME_RATIO']));
    expect(order(result)).toEqual(['B', 'A', 'C']);
    const pointsRatio = run(['A', 'B', 'C'], threeCycle, makeRule(['HEAD_TO_HEAD_POINT_RATIO']));
    expect(order(pointsRatio)).toEqual(['A', 'C', 'B']);
  });

  it('splits by GAMES_WON', () => {
    const result = run(['A', 'B', 'C'], threeCycle, makeRule(['GAMES_WON', 'POINT_RATIO']));
    expect(result.rows[2]?.entryId).toBe('C');
  });

  it('flags a tie no criterion can split and shares the best rank', () => {
    const open: GroupMatchInput = { side1EntryId: 'A', side2EntryId: 'B', status: 'SCHEDULED', games: [] };
    const result = run(['A', 'B', 'C'], [win('A', 'C'), win('B', 'C'), open]);
    expect(result.rows.map((r) => [r.entryId, r.rank, r.needsManualTiebreak])).toEqual([
      ['A', 1, true],
      ['B', 1, true],
      ['C', 3, false],
    ]);
    expect(result.rows.every((r) => !r.qualified)).toBe(true);
  });

  it('never resolves DRAW_OF_LOTS by itself', () => {
    const open: GroupMatchInput = { side1EntryId: 'A', side2EntryId: 'B', status: 'SCHEDULED', games: [] };
    const result = run(['A', 'B', 'C'], [win('A', 'C'), win('B', 'C'), open], makeRule(['DRAW_OF_LOTS', 'GAME_RATIO']));
    expect(result.rows[0]?.needsManualTiebreak).toBe(true);
  });

  const unresolved = (): GroupMatchInput[] => [win('A', 'C'), win('B', 'C'), { side1EntryId: 'A', side2EntryId: 'B', status: 'OFFICIAL', winnerSide: 1, resultType: 'NORMAL', games: [] }];

  it('applies and preserves manual ranks while the tie is unchanged', () => {
    const tied = [win('A', 'C', [[11, 5], [11, 5], [11, 5]]), win('B', 'C', [[11, 5], [11, 5], [11, 5]])];
    const open: GroupMatchInput = { side1EntryId: 'A', side2EntryId: 'B', status: 'SCHEDULED', games: [] };
    const result = run(['A', 'B', 'C'], [...tied, open], makeRule(DEFAULT_ORDER), { manualRanks: { B: 1, A: 2 } });
    expect(result.rows.map((r) => [r.entryId, r.rank, r.manualRank, r.needsManualTiebreak])).toEqual([
      ['B', 1, 1, false],
      ['A', 2, 2, false],
      ['C', 3, null, false],
    ]);
  });

  it('drops manual ranks that no longer fit the tie', () => {
    const tied = [win('A', 'C'), win('B', 'C')];
    const open: GroupMatchInput = { side1EntryId: 'A', side2EntryId: 'B', status: 'SCHEDULED', games: [] };
    for (const stale of [{ B: 2, A: 3 }, { A: 1 }, { A: 1, B: 1 }]) {
      const result = run(['A', 'B', 'C'], [...tied, open], makeRule(DEFAULT_ORDER), { manualRanks: stale });
      expect(result.rows.every((r) => r.manualRank === null)).toBe(true);
      expect(result.rows[0]?.needsManualTiebreak).toBe(true);
    }
    expect(unresolved()).toHaveLength(3);
  });
});

describe('zero samples', () => {
  it('orders a player who lost every game without dividing by zero', () => {
    const matches = [win('A', 'B'), win('A', 'C'), win('B', 'C', [[11, 0], [11, 0], [11, 0]]), win('C', 'D'), win('B', 'D'), win('A', 'D')];
    const result = run(['A', 'B', 'C', 'D'], matches, makeRule(['GAME_RATIO', 'POINT_RATIO']));
    expect(order(result)).toEqual(['A', 'B', 'C', 'D']);
    for (const row of result.rows) {
      expect(Number.isFinite(row.pointsFor)).toBe(true);
    }
    const zeroLoser = run(['X', 'Y'], [win('X', 'Y', [[11, 0], [11, 0], [11, 0]])], makeRule(['GAME_RATIO']));
    expect(order(zeroLoser)).toEqual(['X', 'Y']);
  });

  it('treats players with no games yet as equal and needing a manual order', () => {
    const result = run(['A', 'B', 'C'], []);
    expect(result.rows.every((r) => r.rank === 1 && r.needsManualTiebreak)).toBe(true);
  });

  it('ranks all-zero-denominator players equal on ratio criteria', () => {
    const a = win('A', 'C', [[11, 0], [11, 0], [11, 0]]);
    const b = win('B', 'C', [[11, 0], [11, 0], [11, 0]]);
    const result = run(['A', 'B', 'C'], [a, b], makeRule(['GAME_RATIO', 'POINT_RATIO']));
    expect(result.rows[0]?.needsManualTiebreak).toBe(true);
    expect(result.rows[2]?.entryId).toBe('C');
  });
});

describe('walkover, retirement and withdrawal', () => {
  it('COUNT_PLAYED_ONLY: walkover and retirement use played games and the configured loser points', () => {
    const wo = win('A', 'B', [], { resultType: 'WALKOVER' });
    const ret = win('A', 'C', [[11, 5], [3, 11]], { resultType: 'RETIRED' });
    const result = run(['A', 'B', 'C'], [wo, ret, win('B', 'C')]);
    const row = (id: string) => result.rows.find((r) => r.entryId === id);
    expect(row('A')).toMatchObject({ matchPoints: 4, gamesFor: 1, gamesAgainst: 1, pointsFor: 14, pointsAgainst: 16 });
    expect(row('B')).toMatchObject({ matchPoints: 2, gamesFor: 3, gamesAgainst: 0 });
    expect(row('C')).toMatchObject({ matchPoints: 0 + 1, gamesFor: 1 });
  });

  it('AWARD_REMAINING_TO_WINNER: the winner receives the missing games', () => {
    const rule = makeRule(DEFAULT_ORDER, { unfinishedMatchScoring: 'AWARD_REMAINING_TO_WINNER', awardedGamePoints: 11 });
    const wo = win('A', 'B', [], { resultType: 'WALKOVER' });
    const ret = win('A', 'C', [[11, 5], [3, 11]], { resultType: 'RETIRED' });
    const result = run(['A', 'B', 'C'], [wo, ret], rule);
    const a = result.rows.find((r) => r.entryId === 'A');
    expect(a).toMatchObject({ gamesFor: 3 + 3, gamesAgainst: 1, pointsFor: 33 + 14 + 22 });
  });

  it('voided matches leave the table and the completeness check', () => {
    const voided = win('A', 'B', undefined, { isVoided: true });
    const open: GroupMatchInput = { side1EntryId: 'B', side2EntryId: 'C', status: 'SCHEDULED', games: [], isVoided: true };
    const result = run(['A', 'B', 'C'], [voided, open, win('A', 'C')]);
    expect(result.rows.find((r) => r.entryId === 'B')?.played).toBe(0);
    expect(result.complete).toBe(true);
  });
});

describe('withdrawn entries', () => {
  const matches = [win('A', 'B'), win('A', 'C'), win('A', 'D'), win('B', 'C'), win('B', 'D'), win('C', 'D')];

  it('keeps the withdrawn rank but passes the qualifying slot to the next entry', () => {
    const result = run(['A', 'B', 'C', 'D'], matches, makeRule(DEFAULT_ORDER), { withdrawnEntryIds: ['B'] });
    const byId = Object.fromEntries(result.rows.map((r) => [r.entryId, r]));
    expect(byId.B).toMatchObject({ rank: 2, qualified: false });
    expect(byId.A.qualified).toBe(true);
    expect(byId.C).toMatchObject({ rank: 3, qualified: true });
    expect(byId.D.qualified).toBe(false);
  });

  it('does not qualify anyone on a tie that straddles the shifted boundary', () => {
    const tied = [win('A', 'B'), win('A', 'C'), win('A', 'D'), win('B', 'C'), win('C', 'D'), win('D', 'B')];
    const result = run(['A', 'B', 'C', 'D'], tied, makeRule(['HEAD_TO_HEAD_POINTS']), { withdrawnEntryIds: ['A'] });
    expect(result.rows.filter((r) => r.qualified)).toHaveLength(0);
  });
});

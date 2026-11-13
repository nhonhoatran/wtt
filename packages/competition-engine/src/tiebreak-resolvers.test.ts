import { describe, expect, it } from 'vitest';
import type { MatchContribution } from './group-match-scoring.js';
import { resolveTie, type EntryTotals, type TieContext } from './tiebreak-resolvers.js';

const totals = (gf: number, ga: number, pf: number, pa: number): EntryTotals => ({ gamesFor: gf, gamesAgainst: ga, pointsFor: pf, pointsAgainst: pa });
const contribution = (over: Partial<MatchContribution>): MatchContribution => ({
  entry1: 'A',
  entry2: 'B',
  winner: 'A',
  games1: 3,
  games2: 0,
  points1: 33,
  points2: 10,
  matchPoints1: 2,
  matchPoints2: 1,
  ...over,
});

describe('resolveTie', () => {
  const ctx: TieContext = {
    totals: new Map([
      ['A', totals(6, 3, 100, 90)],
      ['B', totals(6, 2, 90, 100)],
      ['C', totals(6, 3, 100, 90)],
    ]),
    contributions: [contribution({}), contribution({ entry1: 'B', entry2: 'C', winner: 'B' }), contribution({ entry1: 'A', entry2: 'C', winner: 'C', games1: 0, games2: 3, points1: 10, points2: 33, matchPoints1: 1, matchPoints2: 2 })],
  };

  it('returns a single block for a one-entry set', () => {
    expect(resolveTie(['A'], ['GAME_RATIO'], ctx)).toEqual([['A']]);
  });

  it('splits by the first criterion that separates and re-resolves each subset', () => {
    expect(resolveTie(['A', 'B', 'C'], ['GAME_RATIO'], ctx)).toEqual([['B'], ['A', 'C']]);
    expect(resolveTie(['A', 'B', 'C'], ['GAME_RATIO', 'HEAD_TO_HEAD_POINTS'], ctx)).toEqual([['B'], ['C'], ['A']]);
  });

  it('falls through criteria that do not separate', () => {
    expect(resolveTie(['A', 'C'], ['GAMES_WON', 'POINT_RATIO'], ctx)).toEqual([['A', 'C']]);
    expect(resolveTie(['A', 'C'], ['GAMES_WON', 'HEAD_TO_HEAD_GAME_RATIO'], ctx)).toEqual([['C'], ['A']]);
  });

  it('stops at DRAW_OF_LOTS instead of picking', () => {
    expect(resolveTie(['A', 'C'], ['DRAW_OF_LOTS', 'HEAD_TO_HEAD_POINTS'], ctx)).toEqual([['A', 'C']]);
    expect(resolveTie(['A', 'C'], [], ctx)).toEqual([['A', 'C']]);
  });

  it('ignores matches outside the tie set for head-to-head', () => {
    expect(resolveTie(['A', 'B'], ['HEAD_TO_HEAD_POINT_RATIO'], ctx)).toEqual([['A'], ['B']]);
  });
});

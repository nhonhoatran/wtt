import { describe, expect, it } from 'vitest';
import {
  isCountedGroupMatch,
  scoreMatch,
  type GroupMatchInput,
  type GroupScoringRuleInput,
  type MatchFormatInput,
} from './group-match-scoring.js';
import { DrawParamsError } from './types.js';

const rule: GroupScoringRuleInput = {
  pointsWin: 2,
  pointsLoss: 1,
  pointsWalkoverLoss: 0,
  pointsUnfinishedLoss: 0,
  unfinishedMatchScoring: 'COUNT_PLAYED_ONLY',
  awardedGamePoints: null,
  tiebreakers: ['HEAD_TO_HEAD_POINTS'],
};
const bestOf5: MatchFormatInput = { bestOf: 5, pointsPerGame: 11 };
const award = (awardedGamePoints: number | null): GroupScoringRuleInput => ({
  ...rule,
  unfinishedMatchScoring: 'AWARD_REMAINING_TO_WINNER',
  awardedGamePoints,
});
const match = (over: Partial<GroupMatchInput>): GroupMatchInput => ({
  side1EntryId: 'A',
  side2EntryId: 'B',
  status: 'OFFICIAL',
  resultType: 'NORMAL',
  winnerSide: 1,
  games: [],
  ...over,
});

describe('scoreMatch', () => {
  const normalGames = [
    { score1: 11, score2: 5 },
    { score1: 9, score2: 11 },
    { score1: 11, score2: 7 },
    { score1: 11, score2: 8 },
  ];

  it('scores a normal match from games and points', () => {
    const c = scoreMatch(match({ games: normalGames }), rule, bestOf5);
    expect(c).toMatchObject({ winner: 'A', games1: 3, games2: 1, points1: 42, points2: 31, matchPoints1: 2, matchPoints2: 1 });
  });

  it('gives the loser pointsLoss, pointsWalkoverLoss or pointsUnfinishedLoss by result type', () => {
    const loser = (resultType: GroupMatchInput['resultType']) => scoreMatch(match({ resultType, winnerSide: 2 }), rule, bestOf5).matchPoints1;
    expect(loser('NORMAL')).toBe(1);
    expect(loser('WALKOVER')).toBe(0);
    expect(loser('RETIRED')).toBe(0);
    expect(loser('DISQUALIFIED')).toBe(0);
    const custom = { ...rule, pointsWalkoverLoss: -1, pointsUnfinishedLoss: 3 };
    expect(scoreMatch(match({ resultType: 'WALKOVER', winnerSide: 2 }), custom, bestOf5).matchPoints1).toBe(-1);
    expect(scoreMatch(match({ resultType: 'RETIRED', winnerSide: 2 }), custom, bestOf5).matchPoints1).toBe(3);
  });

  it('COUNT_PLAYED_ONLY: a walkover adds no games or points', () => {
    const c = scoreMatch(match({ resultType: 'WALKOVER' }), rule, bestOf5);
    expect(c).toMatchObject({ games1: 0, games2: 0, points1: 0, points2: 0, winner: 'A' });
  });

  it('COUNT_PLAYED_ONLY: a retirement keeps only the games played', () => {
    const played = [{ score1: 11, score2: 3 }, { score1: 4, score2: 11 }];
    const c = scoreMatch(match({ resultType: 'RETIRED', games: played }), rule, bestOf5);
    expect(c).toMatchObject({ games1: 1, games2: 1, points1: 15, points2: 14 });
  });

  it('AWARD_REMAINING_TO_WINNER: a walkover gives the winner all needed games at pointsPerGame by default', () => {
    const c = scoreMatch(match({ resultType: 'WALKOVER', winnerSide: 2 }), award(null), bestOf5);
    expect(c).toMatchObject({ games1: 0, games2: 3, points1: 0, points2: 33 });
  });

  it('AWARD_REMAINING_TO_WINNER: uses awardedGamePoints and only the missing games after a retirement', () => {
    const played = [{ score1: 11, score2: 3 }, { score1: 11, score2: 6 }, { score1: 2, score2: 11 }];
    const c = scoreMatch(match({ resultType: 'RETIRED', games: played }), award(21), bestOf5);
    expect(c).toMatchObject({ games1: 3, games2: 1, points1: 24 + 21, points2: 20 });
  });

  it('AWARD_REMAINING_TO_WINNER leaves a normal match untouched and never over-awards', () => {
    const normal = scoreMatch(match({ games: normalGames }), award(11), bestOf5);
    expect(normal.games1).toBe(3);
    const full = [1, 2, 3].map(() => ({ score1: 11, score2: 0 }));
    expect(scoreMatch(match({ resultType: 'DISQUALIFIED', games: full }), award(11), bestOf5).games1).toBe(3);
  });

  it('rejects an official match without a winner', () => {
    expect(() => scoreMatch(match({ winnerSide: null }), rule, bestOf5)).toThrow(DrawParamsError);
  });
});

describe('isCountedGroupMatch', () => {
  it('counts only official, real, non-voided matches', () => {
    expect(isCountedGroupMatch(match({}))).toBe(true);
    expect(isCountedGroupMatch(match({ status: 'LIVE' }))).toBe(false);
    expect(isCountedGroupMatch(match({ isVoided: true }))).toBe(false);
    expect(isCountedGroupMatch(match({ resultType: 'BYE' }))).toBe(false);
  });
});

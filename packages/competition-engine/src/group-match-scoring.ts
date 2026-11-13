import { isPlayedMatch, type TiebreakCriterion } from '@kamito/shared';
import { DrawParamsError } from './types.js';

export type MatchResultType = 'NORMAL' | 'WALKOVER' | 'RETIRED' | 'DISQUALIFIED' | 'BYE';

/** Mirrors the Prisma GroupScoringRule row. */
export interface GroupScoringRuleInput {
  pointsWin: number;
  pointsLoss: number;
  pointsWalkoverLoss: number;
  pointsUnfinishedLoss: number;
  unfinishedMatchScoring: 'COUNT_PLAYED_ONLY' | 'AWARD_REMAINING_TO_WINNER';
  /** Points per awarded game; null falls back to the match format's pointsPerGame. */
  awardedGamePoints: number | null;
  tiebreakers: readonly TiebreakCriterion[];
}

export interface MatchFormatInput {
  bestOf: number;
  pointsPerGame: number;
}

export interface GroupMatchInput {
  side1EntryId: string;
  side2EntryId: string;
  status: 'SCHEDULED' | 'LIVE' | 'OFFICIAL';
  resultType?: MatchResultType | null;
  winnerSide?: 1 | 2 | null;
  /** Excluded from the table (withdrawal policy VOID_ALL_RESULTS). */
  isVoided?: boolean;
  games: readonly { score1: number; score2: number }[];
}

export interface MatchContribution {
  entry1: string;
  entry2: string;
  winner: string;
  games1: number;
  games2: number;
  points1: number;
  points2: number;
  matchPoints1: number;
  matchPoints2: number;
}

export function isCountedGroupMatch(match: GroupMatchInput): boolean {
  return isPlayedMatch(match);
}

export function scoreMatch(match: GroupMatchInput, rule: GroupScoringRuleInput, format: MatchFormatInput): MatchContribution {
  if (match.winnerSide !== 1 && match.winnerSide !== 2) {
    throw new DrawParamsError('INVALID_MATCH_DATA', `Official match ${match.side1EntryId} vs ${match.side2EntryId} has no winner`);
  }
  const winnerSide = match.winnerSide;
  const resultType = match.resultType ?? 'NORMAL';
  let games1 = 0;
  let games2 = 0;
  let points1 = 0;
  let points2 = 0;
  for (const game of match.games) {
    points1 += game.score1;
    points2 += game.score2;
    if (game.score1 > game.score2) games1++;
    else if (game.score2 > game.score1) games2++;
  }

  if (resultType !== 'NORMAL' && rule.unfinishedMatchScoring === 'AWARD_REMAINING_TO_WINNER') {
    const needed = Math.floor(format.bestOf / 2) + 1;
    const remaining = Math.max(0, needed - (winnerSide === 1 ? games1 : games2));
    const awardedPoints = remaining * (rule.awardedGamePoints ?? format.pointsPerGame);
    if (winnerSide === 1) {
      games1 += remaining;
      points1 += awardedPoints;
    } else {
      games2 += remaining;
      points2 += awardedPoints;
    }
  }

  const loserPoints =
    resultType === 'WALKOVER' ? rule.pointsWalkoverLoss : resultType === 'NORMAL' ? rule.pointsLoss : rule.pointsUnfinishedLoss;
  return {
    entry1: match.side1EntryId,
    entry2: match.side2EntryId,
    winner: winnerSide === 1 ? match.side1EntryId : match.side2EntryId,
    games1,
    games2,
    points1,
    points2,
    matchPoints1: winnerSide === 1 ? rule.pointsWin : loserPoints,
    matchPoints2: winnerSide === 2 ? rule.pointsWin : loserPoints,
  };
}

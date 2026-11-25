import type { Prisma } from '@kamito/db';
import { publicScope } from '../public-scope/public-scope.js';

const sideOf = (playerId: string): Prisma.EntryWhereInput => ({
  competitor: { OR: [{ playerId }, { pair: { OR: [{ playerAId: playerId }, { playerBId: playerId }] } }] },
});

/** The one definition of a player's public results; the results list and the win-loss record both use it. */
export function publicPlayerResultsWhere(playerId: string): Prisma.MatchWhereInput {
  const entry = sideOf(playerId);
  return { AND: [
    publicScope.matchIn({}),
    { status: 'OFFICIAL', isVoided: false },
    { OR: [{ side1Entry: entry }, { side2Entry: entry }] },
  ] };
}

/** Wins and losses restricted to the player's own side of each result. */
export function publicPlayerOutcomeWhere(playerId: string, outcome: 'win' | 'loss'): Prisma.MatchWhereInput {
  const entry = sideOf(playerId);
  const own = outcome === 'win' ? [1, 2] : [2, 1];
  return { AND: [
    publicPlayerResultsWhere(playerId),
    { OR: [{ winnerSide: own[0], side1Entry: entry }, { winnerSide: own[1], side2Entry: entry }] },
  ] };
}

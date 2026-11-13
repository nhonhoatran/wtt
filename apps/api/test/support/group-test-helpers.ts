import type { AuthTestKit } from './auth-test-kit.js';

type Policy = 'KEEP_PLAYED_RESULTS' | 'VOID_ALL_RESULTS' | null;

/** Scoring rule without DRAW_OF_LOTS, so an unbroken tie stays a manual tiebreak. */
export function createScoringRule(kit: AuthTestKit, tag: string, withdrawalPolicy: Policy): Promise<{ id: string }> {
  return kit.prisma.groupScoringRule.create({
    data: {
      name: `Rule ${tag}`,
      pointsWin: 2,
      pointsLoss: 1,
      pointsWalkoverLoss: 0,
      pointsUnfinishedLoss: 0,
      unfinishedMatchScoring: 'COUNT_PLAYED_ONLY',
      withdrawalPolicy,
      tiebreakers: ['GAME_RATIO'],
    },
  });
}

/** Confirms every unfinished match of the group; `winnerOf` returns the winning entry id. */
export async function finishGroupMatches(kit: AuthTestKit, groupId: string, winnerOf: (side1: string, side2: string) => string) {
  const matches = await kit.prisma.match.findMany({ where: { groupId, status: { not: 'OFFICIAL' } } });
  for (const m of matches) {
    const winnerSide = winnerOf(m.side1EntryId!, m.side2EntryId!) === m.side1EntryId ? 1 : 2;
    await kit.prisma.match.update({
      where: { id: m.id },
      data: { status: 'OFFICIAL', resultType: 'NORMAL', winnerSide, games1: winnerSide === 1 ? 3 : 0, games2: winnerSide === 2 ? 3 : 0 },
    });
  }
}

/** Lower slot beats higher slot, so a group has a strict order. */
export async function slotWinner(kit: AuthTestKit, groupId: string) {
  const members = await kit.prisma.groupMember.findMany({ where: { groupId } });
  const slot = new Map(members.map((m) => [m.entryId, m.slot]));
  return (a: string, b: string) => (slot.get(a)! < slot.get(b)! ? a : b);
}

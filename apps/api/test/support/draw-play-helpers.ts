import type { AuthTestKit } from './auth-test-kit.js';

/** Plays every unfinished match of a knockout draw (side 1 wins), advancing winners round by round. */
export async function playOutKnockout(kit: AuthTestKit, drawId: string): Promise<void> {
  const matches = await kit.prisma.match.findMany({ where: { drawId }, orderBy: [{ round: { number: 'asc' } }, { orderInRound: 'asc' }] });
  for (const planned of matches) {
    const m = await kit.prisma.match.findUniqueOrThrow({ where: { id: planned.id } });
    if (m.status !== 'OFFICIAL') {
      await kit.prisma.match.update({ where: { id: m.id }, data: { status: 'OFFICIAL', resultType: 'NORMAL', winnerSide: 1, games1: 3, games2: 0 } });
    }
    const winner = m.status === 'OFFICIAL' ? (m.winnerSide === 1 ? m.side1EntryId : m.side2EntryId) : m.side1EntryId;
    if (m.nextMatchId && winner) {
      await kit.prisma.match.update({ where: { id: m.nextMatchId }, data: { [m.nextMatchSide === 1 ? 'side1EntryId' : 'side2EntryId']: winner } });
    }
  }
}

export const cleanupDraws = async (kit: AuthTestKit, subEventIds: string[], eventId: string | undefined) => {
  const draws = await kit.prisma.draw.findMany({ where: { subEventId: { in: subEventIds } }, select: { id: true, groups: { select: { id: true } } } });
  const entityIds = draws.flatMap((d) => [d.id, ...d.groups.map((g) => g.id)]);
  await kit.prisma.draw.deleteMany({ where: { id: { in: draws.map((d) => d.id) } } });
  await kit.prisma.auditLog.deleteMany({ where: { entityId: { in: entityIds } } });
  await kit.prisma.eventMatchCounter.deleteMany({ where: { eventId } });
};

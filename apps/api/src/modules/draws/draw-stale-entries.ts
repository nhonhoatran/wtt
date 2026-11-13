import type { Draw, Prisma } from '@kamito/db';
import { conflict } from './draw-errors.js';

type Tx = Prisma.TransactionClient;

/**
 * Publish gate: the entries drawn must match the CONFIRMED entries of the stage right now.
 * A withdrawn entry is tolerated when its walkover is already recorded (draft rebuilt after an unpublish).
 * MAIN of a group-fed sub-event holds no entries until the groups finish, so there is nothing to compare.
 */
export async function assertNoStaleEntries(tx: Tx, draw: Draw): Promise<void> {
  if (draw.kind === 'MAIN') {
    const subEvent = await tx.subEvent.findUniqueOrThrow({ where: { id: draw.subEventId }, select: { format: true } });
    if (subEvent.format === 'GROUP_KNOCKOUT') return;
  }
  const drawn = await drawnEntryIds(tx, draw);
  const stage = draw.kind === 'QUALIFYING' ? 'QUALIFYING' : 'MAIN';
  const [confirmed, withdrawn] = await Promise.all([
    tx.entry.findMany({ where: { subEventId: draw.subEventId, status: 'CONFIRMED', stage }, select: { id: true } }),
    tx.entry.findMany({ where: { id: { in: drawn }, status: 'WITHDRAWN' }, select: { id: true } }),
  ]);
  const drawnSet = new Set(drawn);
  const missingEntryIds = confirmed.map((e) => e.id).filter((id) => !drawnSet.has(id));
  const handled = draw.kind === 'GROUP' ? new Set<string>() : await walkoverHandled(tx, draw.id, withdrawn.map((e) => e.id));
  const withdrawnEntryIds = withdrawn.map((e) => e.id).filter((id) => !handled.has(id));
  if (withdrawnEntryIds.length || missingEntryIds.length) {
    throw conflict('DRAW_STALE_ENTRIES', 'Danh sách VĐV đã thay đổi sau khi bốc thăm. Hãy bốc lại trước khi công bố', {
      withdrawnEntryIds,
      missingEntryIds,
    });
  }
}

async function drawnEntryIds(tx: Tx, draw: Draw): Promise<string[]> {
  if (draw.kind === 'GROUP') {
    const members = await tx.groupMember.findMany({ where: { group: { drawId: draw.id } }, select: { entryId: true } });
    return members.map((m) => m.entryId);
  }
  const positions = await tx.bracketPosition.findMany({ where: { drawId: draw.id, entryId: { not: null } }, select: { entryId: true } });
  return positions.map((p) => p.entryId as string);
}

async function walkoverHandled(tx: Tx, drawId: string, entryIds: string[]): Promise<Set<string>> {
  if (!entryIds.length) return new Set();
  const matches = await tx.match.findMany({
    where: { drawId, resultType: 'WALKOVER', OR: [{ side1EntryId: { in: entryIds } }, { side2EntryId: { in: entryIds } }] },
    select: { side1EntryId: true, side2EntryId: true, winnerSide: true },
  });
  const losers = matches.map((m) => (m.winnerSide === 1 ? m.side2EntryId : m.side1EntryId));
  return new Set(losers.filter((id): id is string => Boolean(id)));
}

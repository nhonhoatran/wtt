import type { Prisma } from '@kamito/db';
import { markRankingDirty } from './ranking-dirty-marker.js';

/** Marks every ranked sub-event of an event; call inside the writer's transaction. */
export async function markEventRankingDirty(tx: Prisma.TransactionClient, eventId: string): Promise<string[]> {
  const rows = await tx.subEvent.findMany({ where: { eventId, rankingListId: { not: null } }, select: { id: true } });
  return markRankingDirty(tx, rows.map((row) => row.id));
}

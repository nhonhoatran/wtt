import type { Prisma } from '../generated/prisma/client.js';

type SubEventReader = Pick<Prisma.TransactionClient, 'subEvent'>;

/** Sub-events that still owe a recompute for the list: assigned to it, or still holding its AUTO rows. */
export async function findDirtySubEventIds(db: SubEventReader, listId: string): Promise<string[]> {
  const rows = await db.subEvent.findMany({
    where: {
      rankingDirtyAt: { not: null },
      OR: [{ rankingListId: listId }, { rankingPoints: { some: { rankingListId: listId, source: 'AUTO' } } }],
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  return rows.map((row) => row.id);
}

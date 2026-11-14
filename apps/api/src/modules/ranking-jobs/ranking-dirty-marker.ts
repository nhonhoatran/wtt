import { lockSubEventsInOrder, type Prisma } from '@kamito/db';

/**
 * Marks sub-events as needing a ranking recompute inside the caller's transaction. Locks are taken in
 * ascending id order (SubEvent first) to stay deadlock-free with the other writers. GREATEST keeps the
 * value strictly increasing at the column's millisecond precision, so the worker's compare-and-clear
 * never wipes a newer mark. Enqueue the returned ids only after the transaction commits.
 */
export async function markRankingDirty(tx: Prisma.TransactionClient, subEventIds: string[]): Promise<string[]> {
  const ids = [...new Set(subEventIds)].sort();
  if (!ids.length) return [];
  await lockSubEventsInOrder(tx, ids);
  await tx.$executeRaw`
    UPDATE "SubEvent"
    SET "rankingDirtyAt" = GREATEST(clock_timestamp() AT TIME ZONE 'UTC', "rankingDirtyAt" + interval '1 millisecond')
    WHERE "id" = ANY(${ids}::text[])`;
  return ids;
}

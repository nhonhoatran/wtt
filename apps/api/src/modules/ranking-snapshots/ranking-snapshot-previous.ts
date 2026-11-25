import type { Prisma } from '@kamito/db';
import type { PrismaService } from '../prisma/prisma.service.js';

export interface PreviousSnapshot {
  id: string;
  asOfDate: Date;
  publishedAt: Date | null;
}

type Client = PrismaService | Prisma.TransactionClient;

/**
 * Single definition of "previous period": the latest PUBLISHED snapshot of the list other than
 * the given one. Same ordering as the worker's loadPreviousRanks, so summary, rows, publish and
 * the worker's movement all compare against the same snapshot. For an already published snapshot,
 * only snapshots published before it count, so reopening an old period still shows its own predecessor.
 */
export function findPreviousSnapshot(
  client: Client,
  snapshot: { id?: string; rankingListId: string; publishedAt?: Date | null },
): Promise<PreviousSnapshot | null> {
  return client.rankingSnapshot.findFirst({
    where: {
      rankingListId: snapshot.rankingListId,
      status: 'PUBLISHED',
      ...(snapshot.id && { id: { not: snapshot.id } }),
      ...(snapshot.publishedAt && { publishedAt: { lt: snapshot.publishedAt } }),
    },
    orderBy: [{ asOfDate: 'desc' }, { publishedAt: 'desc' }],
    select: { id: true, asOfDate: true, publishedAt: true },
  });
}

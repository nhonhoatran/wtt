import type { Prisma } from '@kamito/db';
import type { SnapshotRowDraft } from '@kamito/ranking-engine';
import { DEFAULT_SNAPSHOT_BATCH_SIZE } from './ranking-deps.js';
import { fromIsoDate } from './ranking-dates.js';

type Tx = Prisma.TransactionClient;

/** Replaces the DRAFT of the same (list, asOf) with a new one holding `rows`; returns the new snapshot id. */
export async function replaceDraftSnapshot(
  tx: Tx,
  input: { listId: string; asOf: string; rows: SnapshotRowDraft[]; batchSize?: number },
): Promise<string> {
  const asOfDate = fromIsoDate(input.asOf);
  await tx.rankingSnapshot.deleteMany({ where: { rankingListId: input.listId, asOfDate, status: 'DRAFT' } });
  const snapshot = await tx.rankingSnapshot.create({ data: { rankingListId: input.listId, asOfDate, status: 'DRAFT' }, select: { id: true } });

  const batchSize = input.batchSize ?? DEFAULT_SNAPSHOT_BATCH_SIZE;
  for (let start = 0; start < input.rows.length; start += batchSize) {
    await tx.rankingSnapshotRow.createMany({
      data: input.rows.slice(start, start + batchSize).map((row) => ({
        snapshotId: snapshot.id,
        playerId: row.playerId,
        rank: row.rank,
        previousRank: row.previousRank,
        movement: row.movement,
        points: row.points,
        resultsCounted: row.resultsCounted,
        breakdown: row.breakdown as unknown as Prisma.InputJsonValue,
      })),
    });
  }
  return snapshot.id;
}

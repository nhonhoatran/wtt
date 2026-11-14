import { advisoryLock, findDirtySubEventIds } from '@kamito/db';
import { buildSnapshotRows } from '@kamito/ranking-engine';
import { loadPreviousRanks, loadSnapshotLedger } from '../ranking/load-snapshot-ledger.js';
import { ISO_DATE_PATTERN } from '../ranking/ranking-dates.js';
import { RANKING_TX_MAX_WAIT_MS, RANKING_TX_TIMEOUT_MS, type RankingDeps } from '../ranking/ranking-deps.js';
import { replaceDraftSnapshot } from '../ranking/write-snapshot-rows.js';
import { recomputeSubEvent } from './ranking-recompute-processor.js';

/** Thrown when sub-events of the list are still dirty after the recompute pass; the job retries. */
export class SnapshotBlockedError extends Error {
  constructor(
    readonly listId: string,
    readonly subEventIds: string[],
  ) {
    super(`ranking list ${listId}: ${subEventIds.length} sub-event(s) not recomputed: ${subEventIds.join(', ')}`);
    this.name = 'SnapshotBlockedError';
  }
}

export type SnapshotOutcome = { outcome: 'built'; snapshotId: string; rows: number } | { outcome: 'missing' };

/** Builds (or replaces) the DRAFT snapshot of a list for `asOf`, recomputing dirty sub-events first. */
export async function buildSnapshot(deps: RankingDeps, input: { listId: string; asOf: string }): Promise<SnapshotOutcome> {
  const { listId, asOf } = input;
  if (!ISO_DATE_PATTERN.test(asOf)) throw new RangeError(`invalid asOf date: ${asOf}`);
  const list = await deps.prisma.rankingList.findUnique({ where: { id: listId }, select: { id: true } });
  if (!list) return { outcome: 'missing' };

  for (const subEventId of await findDirtySubEventIds(deps.prisma, listId)) await recomputeSubEvent(deps, subEventId);
  const stillDirty = await findDirtySubEventIds(deps.prisma, listId);
  if (stillDirty.length) throw new SnapshotBlockedError(listId, stillDirty);

  const [ledger, previousRanks] = await Promise.all([loadSnapshotLedger(deps.prisma, listId, asOf), loadPreviousRanks(deps.prisma, listId)]);
  const rows = buildSnapshotRows({ ledger: ledger.rows, asOf, playerNames: ledger.playerNames, previousRanks });

  const snapshotId = await deps.prisma.$transaction(
    async (tx) => {
      await advisoryLock(tx, `ranking-snapshot:${listId}:${asOf}`);
      return replaceDraftSnapshot(tx, { listId, asOf, rows, batchSize: deps.snapshotBatchSize });
    },
    { timeout: RANKING_TX_TIMEOUT_MS, maxWait: RANKING_TX_MAX_WAIT_MS },
  );
  return { outcome: 'built', snapshotId, rows: rows.length };
}

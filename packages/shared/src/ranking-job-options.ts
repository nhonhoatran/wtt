import { RANKING_RECOMPUTE_JOB, RANKING_SNAPSHOT_JOB } from './queue-names.js';

const BACKOFF_MS = 5_000;
const COMPLETED_KEPT = 100;
const FAILED_KEPT = 200;

export interface RankingJobSpec<TData> {
  name: string;
  data: TData;
  opts: {
    jobId: string;
    attempts: number;
    backoff: { type: 'exponential'; delay: number };
    removeOnComplete: { count: number };
    removeOnFail: { count: number };
  };
}

function spec<TData>(name: string, data: TData, jobId: string, attempts: number): RankingJobSpec<TData> {
  return {
    name,
    data,
    opts: {
      jobId,
      attempts,
      backoff: { type: 'exponential', delay: BACKOFF_MS },
      removeOnComplete: { count: COMPLETED_KEPT },
      removeOnFail: { count: FAILED_KEPT },
    },
  };
}

/**
 * Every enqueue gets a fresh id: a fixed id would make BullMQ drop a second enqueue while the first
 * job is still stored, losing the recompute for the later change. The processor serialises runs.
 */
export const rankingRecomputeJob = (subEventId: string): RankingJobSpec<{ subEventId: string }> =>
  spec(RANKING_RECOMPUTE_JOB, { subEventId }, `rank-se-${subEventId}-${globalThis.crypto.randomUUID()}`, 5);

export const rankingSnapshotJob = (listId: string, asOf: string): RankingJobSpec<{ listId: string; asOf: string }> =>
  spec(RANKING_SNAPSHOT_JOB, { listId, asOf }, `rank-snap-${globalThis.crypto.randomUUID()}`, 3);

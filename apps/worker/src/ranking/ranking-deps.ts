import type { PrismaClient } from '@kamito/db';

export interface RankingDeps {
  prisma: PrismaClient;
  /** Puts a recompute job on the queue; the dirty sweep uses it as the safety net. */
  enqueueRecompute: (subEventId: string) => Promise<void>;
  now?: () => Date;
  /** Snapshot rows per INSERT. */
  snapshotBatchSize?: number;
}

/** Recompute rewrites a whole sub-event under row locks, so it needs more than the default 5 s. */
export const RANKING_TX_TIMEOUT_MS = 60_000;
export const RANKING_TX_MAX_WAIT_MS = 30_000;
export const DEFAULT_SNAPSHOT_BATCH_SIZE = 1_000;

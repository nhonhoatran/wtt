import { createPrismaClient } from '@kamito/db';
import { QueueName, RANKING_RECOMPUTE_JOB, RANKING_SNAPSHOT_JOB, RANKING_SWEEP_JOB, rankingRecomputeJob, safeErrorSummary } from '@kamito/shared';
import { Queue, UnrecoverableError, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { sweepDirtySubEvents } from './processors/ranking-dirty-sweep-processor.js';
import { recomputeSubEvent } from './processors/ranking-recompute-processor.js';
import { buildSnapshot } from './processors/ranking-snapshot-processor.js';
import type { RankingDeps } from './ranking/ranking-deps.js';
import type { WorkerEnv } from './worker-env.js';

const SWEEP_SCHEDULER_ID = 'ranking-dirty-sweep';

/** Starts the ranking worker (recompute, snapshot build, dirty sweep); the returned function stops it. */
export async function startRankingWorker(env: WorkerEnv, redis: Redis, logger: Logger): Promise<() => Promise<void>> {
  const prisma = createPrismaClient({ connectionString: env.DATABASE_URL });
  const queueOptions = { connection: redis, prefix: env.QUEUE_PREFIX };
  const queue = new Queue(QueueName.Ranking, queueOptions);
  const deps: RankingDeps = {
    prisma,
    enqueueRecompute: async (subEventId) => {
      const job = rankingRecomputeJob(subEventId);
      await queue.add(job.name, job.data, job.opts);
    },
  };

  await queue.upsertJobScheduler(
    SWEEP_SCHEDULER_ID,
    { every: env.RANKING_DIRTY_SWEEP_INTERVAL_MINUTES * 60_000 },
    { name: RANKING_SWEEP_JOB, opts: { removeOnComplete: { count: 10 }, removeOnFail: { count: 50 } } },
  );

  const worker = new Worker(
    QueueName.Ranking,
    async (job: Job<{ subEventId?: string; listId?: string; asOf?: string }>) => {
      if (job.name === RANKING_SWEEP_JOB) return sweepDirtySubEvents(deps);
      if (job.name === RANKING_RECOMPUTE_JOB) {
        if (!job.data.subEventId) throw new UnrecoverableError('recompute job has no subEventId');
        return { outcome: await recomputeSubEvent(deps, job.data.subEventId) };
      }
      if (job.name === RANKING_SNAPSHOT_JOB) {
        if (!job.data.listId || !job.data.asOf) throw new UnrecoverableError('snapshot job needs listId and asOf');
        return buildSnapshot(deps, { listId: job.data.listId, asOf: job.data.asOf });
      }
      throw new UnrecoverableError(`unknown ranking job: ${job.name}`);
    },
    { ...queueOptions, concurrency: env.RANKING_WORKER_CONCURRENCY },
  );
  worker.on('error', (error) => logger.error({ err: safeErrorSummary(error) }, 'ranking worker error'));
  worker.on('failed', (job, error) =>
    logger.error({ jobId: job?.id, attempt: job?.attemptsMade, err: safeErrorSummary(error) }, 'ranking job failed'),
  );

  return async () => {
    await worker.close();
    await queue.close();
    await prisma.$disconnect();
  };
}

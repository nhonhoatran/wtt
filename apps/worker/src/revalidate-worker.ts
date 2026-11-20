import { QueueName, REVALIDATE_TAGS_JOB, safeErrorSummary } from '@kamito/shared';
import { UnrecoverableError, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { PermanentRevalidateError, revalidateTags } from './processors/revalidate-processor.js';
import type { WorkerEnv } from './worker-env.js';

/** Starts the public cache revalidation worker; the returned function stops it. */
export async function startRevalidateWorker(env: WorkerEnv, redis: Redis, logger: Logger): Promise<() => Promise<void>> {
  const deps = { clientInternalUrl: env.CLIENT_INTERNAL_URL, secret: env.REVALIDATE_SECRET, timeoutMs: env.REVALIDATE_TIMEOUT_MS };
  const worker = new Worker(
    QueueName.Revalidate,
    async (job: Job<{ tags?: unknown }>) => {
      if (job.name !== REVALIDATE_TAGS_JOB) throw new UnrecoverableError(`unknown revalidate job: ${job.name}`);
      try {
        return await revalidateTags(deps, job.data.tags);
      } catch (error) {
        if (error instanceof PermanentRevalidateError) throw new UnrecoverableError(error.message);
        throw error;
      }
    },
    { connection: redis, prefix: env.QUEUE_PREFIX, concurrency: env.REVALIDATE_WORKER_CONCURRENCY },
  );
  worker.on('error', (error) => logger.error({ err: safeErrorSummary(error) }, 'revalidate worker error'));
  worker.on('failed', (job, error) => logger.warn({ jobId: job?.id, attempt: job?.attemptsMade, err: safeErrorSummary(error) }, 'revalidate job failed'));
  return () => worker.close();
}

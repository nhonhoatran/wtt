import { createPrismaClient } from '@kamito/db';
import { QueueName, REVALIDATE_ENQUEUE_TIMEOUT_MS, revalidateTagsJobs, withTimeout } from '@kamito/shared';
import { createObjectStorage } from '@kamito/shared/object-storage';
import { Queue, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { ImportDeps } from './import/import-deps.js';
import { commitImport } from './processors/import-commit-processor.js';
import { cleanupImportFiles } from './processors/import-file-cleanup-processor.js';
import { failImportJob, GENERIC_FAILURE } from './import/import-job-state.js';
import { validateImport } from './processors/import-validate-processor.js';
import type { WorkerEnv } from './worker-env.js';

export const VALIDATE_IMPORT_JOB = 'validate-import';
export const COMMIT_IMPORT_JOB = 'commit-import';
export const IMPORT_CLEANUP_JOB = 'cleanup-import-files';
const CLEANUP_SCHEDULER_ID = 'import-file-cleanup';

/** Starts the import worker (validate, commit, periodic file cleanup); the returned function stops it. */
export async function startImportWorker(env: WorkerEnv, redis: Redis, logger: Logger): Promise<() => Promise<void>> {
  const prisma = createPrismaClient({ connectionString: env.DATABASE_URL });
  const queueOptions = { connection: redis, prefix: env.QUEUE_PREFIX };
  const revalidateQueue = new Queue(QueueName.Revalidate, queueOptions);
  const deps: ImportDeps = {
    prisma,
    storage: createObjectStorage(env),
    env,
    logger,
    enqueueRevalidate: async (tags) => {
      const jobs = revalidateTagsJobs(tags);
      await withTimeout(Promise.all(jobs.map((job) => revalidateQueue.add(job.name, job.data, job.opts))), REVALIDATE_ENQUEUE_TIMEOUT_MS);
    },
  };

  const scheduler = new Queue(QueueName.Import, queueOptions);
  try {
    await scheduler.upsertJobScheduler(
      CLEANUP_SCHEDULER_ID,
      { every: env.IMPORT_CLEANUP_INTERVAL_MINUTES * 60_000 },
      { name: IMPORT_CLEANUP_JOB, opts: { removeOnComplete: { count: 10 }, removeOnFail: { count: 50 } } },
    );
  } catch (error) {
    await Promise.allSettled([scheduler.close(), revalidateQueue.close(), prisma.$disconnect()]);
    throw error;
  }

  const worker = new Worker(
    QueueName.Import,
    async (job: Job<{ importJobId?: string; attemptNo?: number }>) => {
      if (job.name === IMPORT_CLEANUP_JOB) return cleanupImportFiles(deps);
      const id = job.data.importJobId;
      if (!id) throw new Error(`import job ${job.name} has no importJobId`);
      if (job.name === VALIDATE_IMPORT_JOB) return { outcome: await validateImport(deps, id) };
      if (job.name === COMMIT_IMPORT_JOB) return { outcome: await commitImport(deps, id, job.data.attemptNo) };
      throw new Error(`unknown import job: ${job.name}`);
    },
    { ...queueOptions, concurrency: env.IMPORT_WORKER_CONCURRENCY },
  );
  worker.on('error', (error) => logger.error({ err: error.message }, 'import worker error'));
  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, err: error.message }, 'import job failed');
    const exhausted = job && job.attemptsMade >= (job.opts.attempts ?? 1);
    const id = job?.data?.importJobId;
    if (exhausted && id && (job.name === VALIDATE_IMPORT_JOB || job.name === COMMIT_IMPORT_JOB)) {
      failImportJob(deps, id, GENERIC_FAILURE).catch((err: Error) => logger.error({ err: err.message }, 'failImportJob failed'));
    }
  });

  return async () => {
    await worker.close();
    await scheduler.close();
    await revalidateQueue.close();
    await prisma.$disconnect();
  };
}

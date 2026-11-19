import { createPrismaClient } from '@kamito/db';
import { CONTACT_RETENTION_JOB, PUBLISH_ARTICLE_JOB, PUBLISHING_SWEEP_JOB, QueueName } from '@kamito/shared';
import { Queue, UnrecoverableError, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { WorkerEnv } from './worker-env.js';
import { cleanupContactMessages, publishArticle, readPublishSweepInterval, sweepScheduledArticles } from './processors/publishing-processors.js';

const PUBLISHING_SWEEP_ID = 'publishing-due-articles';
const CONTACT_RETENTION_ID = 'contact-retention-daily';

export async function startPublishingWorker(env: WorkerEnv, redis: Redis, logger: Logger): Promise<() => Promise<void>> {
  const prisma = createPrismaClient({ connectionString: env.DATABASE_URL });
  const options = { connection: redis, prefix: env.QUEUE_PREFIX };
  const publishing = new Queue(QueueName.Publishing, options);
  const revalidate = new Queue(QueueName.Revalidate, options);
  let sweepMinutes: number | undefined;
  const syncSweepSchedule = async () => {
    const next = await readPublishSweepInterval(prisma);
    if (next === sweepMinutes) return;
    await publishing.upsertJobScheduler(
      PUBLISHING_SWEEP_ID,
      { every: next * 60_000 },
      { name: PUBLISHING_SWEEP_JOB, data: {}, opts: { attempts: 5, backoff: { type: 'exponential', delay: 10_000 }, removeOnComplete: { count: 20 }, removeOnFail: { count: 100 } } },
    );
    sweepMinutes = next;
  };
  await syncSweepSchedule();
  await publishing.upsertJobScheduler(
    CONTACT_RETENTION_ID,
    { every: 86_400_000 },
    { name: CONTACT_RETENTION_JOB, data: {}, opts: { removeOnComplete: { count: 20 }, removeOnFail: { count: 100 } } },
  );

  const worker = new Worker(
    QueueName.Publishing,
    async (job: Job<{ articleId?: string }>) => {
      if (job.name === PUBLISH_ARTICLE_JOB) {
        if (!job.data.articleId) throw new UnrecoverableError('publish-article job has no articleId');
        return publishArticle(prisma, revalidate, job.data.articleId);
      }
      if (job.name === PUBLISHING_SWEEP_JOB) {
        const result = await sweepScheduledArticles(prisma, revalidate);
        await syncSweepSchedule();
        return result;
      }
      if (job.name === CONTACT_RETENTION_JOB) return cleanupContactMessages(prisma);
      throw new UnrecoverableError(`unknown publishing job: ${job.name}`);
    },
    { ...options, concurrency: 2 },
  );
  worker.on('error', (error) => logger.error({ err: error.message }, 'publishing worker error'));
  worker.on('failed', (job, error) => logger.warn({ jobId: job?.id, name: job?.name, err: error.message }, 'publishing job failed'));

  return async () => {
    await worker.close();
    await publishing.close();
    await revalidate.close();
    await prisma.$disconnect();
  };
}

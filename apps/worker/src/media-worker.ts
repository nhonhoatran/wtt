import { createPrismaClient, type PrismaClient } from '@kamito/db';
import { type AppSettingDefinition, QueueName, resolveAppSetting, tournamentSettings } from '@kamito/shared';
import { effectiveMaxImageBytes, MEDIA_CLEANUP_JOB, MEDIA_PROCESS_JOB, parseVariantWidths } from '@kamito/shared/media';
import { createObjectStorage } from '@kamito/shared/object-storage';
import { Queue, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { z } from 'zod';
import { cleanupExpiredIntents, cleanupStuckProcessing } from './processors/media-intent-cleanup-processor.js';
import { failProcessing, processImage, type MediaProcessorDeps } from './processors/media-image-processor.js';
import type { WorkerEnv } from './worker-env.js';

const CLEANUP_SCHEDULER_ID = 'media-intent-cleanup';

export function buildMediaDeps(env: WorkerEnv, prisma: PrismaClient): MediaProcessorDeps {
  return {
    prisma,
    storage: createObjectStorage(env),
    allowedTypes: env.UPLOAD_ALLOWED_IMAGE_TYPES.map((type) => type.toLowerCase()),
    variantWidths: parseVariantWidths(env.MEDIA_IMAGE_VARIANT_WIDTHS),
    maxBytes: async () => {
      const megabytes = await readSetting(prisma, tournamentSettings.maxImageMegabytes);
      return effectiveMaxImageBytes(megabytes, env.UPLOAD_MAX_IMAGE_BYTES);
    },
    processingTimeoutMinutes: () => readSetting(prisma, tournamentSettings.processingTimeoutMinutes),
  };
}

async function readSetting<T extends z.ZodType>(prisma: PrismaClient, def: AppSettingDefinition<T>): Promise<z.infer<T>> {
  const row = await prisma.appSetting.findUnique({ where: { key: def.key } });
  return resolveAppSetting(def, row?.value);
}

/** Starts the media worker (image processing + intent cleanup); the returned function stops it. */
export async function startMediaWorker(env: WorkerEnv, redis: Redis, logger: Logger): Promise<() => Promise<void>> {
  const prisma = createPrismaClient({ connectionString: env.DATABASE_URL });
  const deps = buildMediaDeps(env, prisma);
  const queueOptions = { connection: redis, prefix: env.QUEUE_PREFIX };

  const scheduler = new Queue(QueueName.Media, queueOptions);
  await scheduler.upsertJobScheduler(
    CLEANUP_SCHEDULER_ID,
    { every: env.MEDIA_CLEANUP_INTERVAL_MINUTES * 60_000 },
    { name: MEDIA_CLEANUP_JOB, opts: { removeOnComplete: { count: 10 }, removeOnFail: { count: 50 } } },
  );

  const worker = new Worker(
    QueueName.Media,
    async (job: Job<{ mediaId?: string }>) => {
      if (job.name === MEDIA_CLEANUP_JOB) {
        return { expired: await cleanupExpiredIntents(deps), stuck: await cleanupStuckProcessing(deps) };
      }
      if (job.name === MEDIA_PROCESS_JOB && job.data.mediaId) return { outcome: await processImage(deps, job.data.mediaId) };
      throw new Error(`unknown media job: ${job.name}`);
    },
    { ...queueOptions, concurrency: env.MEDIA_WORKER_CONCURRENCY },
  );
  worker.on('error', (error) => logger.error({ err: error.message }, 'media worker error'));
  worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, err: error.message }, 'media job failed');
    const exhausted = job && job.attemptsMade >= (job.opts.attempts ?? 1);
    if (job?.name === MEDIA_PROCESS_JOB && exhausted && job.data.mediaId) {
      failProcessing(deps, job.data.mediaId).catch((err: Error) => logger.error({ err: err.message }, 'failProcessing failed'));
    }
  });

  return async () => {
    await worker.close();
    await scheduler.close();
    await prisma.$disconnect();
  };
}

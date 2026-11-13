import { appEnvSchema, csvList, isQueuePrefixValid, parseEnv, requiredString, secretString } from '@kamito/shared';
import { parseVariantWidths, refineStorageEnv, storageEnvShape } from '@kamito/shared/media';
import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();

export const workerEnvSchema = z
  .object({
    APP_ENV: appEnvSchema,
    TZ: requiredString,
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    DATABASE_URL: requiredString,
    REDIS_URL: requiredString,
    QUEUE_PREFIX: requiredString,
    REDIS_EVICTION_CHECK_OVERRIDE: z.string().optional(),
    WORKER_HEALTH_PORT: z.coerce.number().int().positive().default(3010),
    ...storageEnvShape,
    UPLOAD_MAX_IMAGE_BYTES: positiveInt,
    UPLOAD_ALLOWED_IMAGE_TYPES: csvList,
    MEDIA_IMAGE_VARIANT_WIDTHS: csvList,
    MEDIA_WORKER_CONCURRENCY: positiveInt.default(2),
    MEDIA_CLEANUP_INTERVAL_MINUTES: positiveInt.default(15),
    IMPORT_MAX_FILE_BYTES: positiveInt,
    IMPORT_MAX_UNZIPPED_BYTES: positiveInt,
    IMPORT_MAX_ROWS: positiveInt,
    IMPORT_WORKER_CONCURRENCY: positiveInt.default(1),
    IMPORT_CLEANUP_INTERVAL_MINUTES: positiveInt.default(60),
    CLIENT_INTERNAL_URL: z.string().url(),
    REVALIDATE_SECRET: secretString,
    REVALIDATE_TIMEOUT_MS: positiveInt.default(5_000),
    REVALIDATE_WORKER_CONCURRENCY: positiveInt.default(2),
  })
  .superRefine((env, ctx) => {
    if (!isQueuePrefixValid(env.QUEUE_PREFIX, env.APP_ENV)) {
      ctx.addIssue({ code: 'custom', path: ['QUEUE_PREFIX'], message: 'must be "kamito-tt:<APP_ENV>"' });
    }
    refineStorageEnv(env, ctx);
    try {
      parseVariantWidths(env.MEDIA_IMAGE_VARIANT_WIDTHS);
    } catch (error) {
      ctx.addIssue({ code: 'custom', path: ['MEDIA_IMAGE_VARIANT_WIDTHS'], message: (error as Error).message });
    }
  });

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export const loadWorkerEnv = (source: NodeJS.ProcessEnv = process.env): WorkerEnv => parseEnv(workerEnvSchema, source);

import { appEnvSchema, isQueuePrefixValid, parseEnv, requiredString } from '@kamito/shared';
import { z } from 'zod';

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
  })
  .superRefine((env, ctx) => {
    if (!isQueuePrefixValid(env.QUEUE_PREFIX, env.APP_ENV)) {
      ctx.addIssue({ code: 'custom', path: ['QUEUE_PREFIX'], message: 'must be "kamito-tt:<APP_ENV>"' });
    }
  });

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export const loadWorkerEnv = (source: NodeJS.ProcessEnv = process.env): WorkerEnv => parseEnv(workerEnvSchema, source);

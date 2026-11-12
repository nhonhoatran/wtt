import { appEnvSchema, csvList, isQueuePrefixValid, requiredString, secretString } from '@kamito/shared';
import { refineStorageEnv, storageEnvShape } from '@kamito/shared/media';
import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();

export const apiEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
    APP_ENV: appEnvSchema,
    TZ: requiredString,
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    API_PORT: positiveInt.default(3000),
    DATABASE_URL: requiredString,
    REDIS_URL: requiredString,
    QUEUE_PREFIX: requiredString,
    REDIS_EVICTION_CHECK_OVERRIDE: z.string().optional(),
    ...storageEnvShape,
    S3_PRESIGN_ENDPOINT: z.string().url().optional(),
    S3_PUBLIC_BASE_URL: z.string().url().optional(),
    AUTH_SECRET: secretString,
    REVALIDATE_SECRET: secretString,
    SSR_INTERNAL_SECRET: secretString,
    IP_HASH_SALT: secretString,
    CLIENT_INTERNAL_URL: z.string().url(),
    PUBLIC_SITE_URL: z.string().url(),
    ADMIN_PUBLIC_URL: z.string().url(),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    UPLOAD_MAX_IMAGE_BYTES: positiveInt,
    UPLOAD_ALLOWED_IMAGE_TYPES: csvList,
    MEDIA_IMAGE_VARIANT_WIDTHS: csvList,
    // Base URL of the public/ prefix (bucket/CDN); unset = served by the API route /media/public.
    MEDIA_PUBLIC_BASE_URL: z.string().url().optional(),
    IMPORT_MAX_FILE_BYTES: positiveInt,
    IMPORT_MAX_UNZIPPED_BYTES: positiveInt,
    IMPORT_MAX_ROWS: positiveInt,
    PAGINATION_MAX_PAGE_SIZE: positiveInt.default(100),
    QUERY_MAX_LENGTH: positiveInt.default(100),
  })
  .superRefine((env, ctx) => {
    refineStorageEnv(env, ctx);
    if (!isQueuePrefixValid(env.QUEUE_PREFIX, env.APP_ENV)) {
      ctx.addIssue({ code: 'custom', path: ['QUEUE_PREFIX'], message: 'must be "kamito-tt:<APP_ENV>"' });
    }
    const distinct = new Set([env.AUTH_SECRET, env.REVALIDATE_SECRET, env.SSR_INTERNAL_SECRET, env.IP_HASH_SALT]);
    if (distinct.size !== 4) {
      ctx.addIssue({ code: 'custom', path: ['AUTH_SECRET'], message: 'secrets must differ per purpose' });
    }
  });

export type ApiEnv = z.infer<typeof apiEnvSchema>;

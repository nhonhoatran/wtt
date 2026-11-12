import { z } from 'zod';
import { requiredString } from '../env-validation.js';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

/** Shared by API and worker so both resolve the same storage. S3_* is only required for the s3 driver. */
export const storageEnvShape = {
  STORAGE_DRIVER: z.enum(['local', 's3']).default('s3'),
  UPLOAD_LOCAL_DIR: requiredString.default('apps/api/uploads'),
  S3_ENDPOINT: requiredString.optional(),
  S3_REGION: requiredString.optional(),
  S3_ACCESS_KEY_ID: requiredString.optional(),
  S3_SECRET_ACCESS_KEY: requiredString.optional(),
  S3_BUCKET: requiredString.optional(),
  S3_INCOMING_BUCKET: requiredString.optional(),
  S3_FORCE_PATH_STYLE: booleanString.default(true),
};

export type StorageEnv = z.infer<z.ZodObject<typeof storageEnvShape>>;

const S3_REQUIRED = ['S3_ENDPOINT', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET'] as const;

export function refineStorageEnv(env: StorageEnv, ctx: z.RefinementCtx): void {
  if (env.STORAGE_DRIVER !== 's3') return;
  for (const name of S3_REQUIRED) {
    if (!env[name]) ctx.addIssue({ code: 'custom', path: [name], message: 'missing (required when STORAGE_DRIVER=s3)' });
  }
}

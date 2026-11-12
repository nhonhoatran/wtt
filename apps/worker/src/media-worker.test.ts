import type { PrismaClient } from '@kamito/db';
import { describe, expect, it } from 'vitest';
import { buildMediaDeps } from './media-worker.js';
import { loadWorkerEnv } from './worker-env.js';

const base = {
  APP_ENV: 'staging',
  TZ: 'UTC',
  DATABASE_URL: 'postgresql://u@h/db',
  REDIS_URL: 'redis://h:6379',
  QUEUE_PREFIX: 'kamito-tt:staging',
  STORAGE_DRIVER: 'local',
  UPLOAD_MAX_IMAGE_BYTES: '5242880',
  UPLOAD_ALLOWED_IMAGE_TYPES: 'image/jpeg,image/png',
  MEDIA_IMAGE_VARIANT_WIDTHS: '320,640',
  IMPORT_MAX_FILE_BYTES: '5242880',
  IMPORT_MAX_UNZIPPED_BYTES: '52428800',
  IMPORT_MAX_ROWS: '5000',
};

// buildMediaDeps only stores the client; the variant-width wiring does not touch the database.
const unusedPrisma = {} as PrismaClient;

describe('buildMediaDeps', () => {
  it('takes variant widths from MEDIA_IMAGE_VARIANT_WIDTHS, sorted and de-duplicated', () => {
    const env = loadWorkerEnv({ ...base, MEDIA_IMAGE_VARIANT_WIDTHS: '800, 400,800,200' });
    expect(buildMediaDeps(env, unusedPrisma).variantWidths).toEqual([200, 400, 800]);
  });

  it('keeps the default widths when the env value is the default', () => {
    expect(buildMediaDeps(loadWorkerEnv(base), unusedPrisma).variantWidths).toEqual([320, 640]);
  });
});

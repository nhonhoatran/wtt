import { describe, expect, it } from 'vitest';
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

describe('loadWorkerEnv', () => {
  it('parses a valid env with defaults', () => {
    expect(loadWorkerEnv(base)).toMatchObject({ WORKER_HEALTH_PORT: 3010, LOG_LEVEL: 'info', MEDIA_WORKER_CONCURRENCY: 2, IMPORT_WORKER_CONCURRENCY: 1 });
  });

  it('rejects a prefix belonging to another environment', () => {
    expect(() => loadWorkerEnv({ ...base, QUEUE_PREFIX: 'kamito-tt:production' })).toThrow(/QUEUE_PREFIX/);
  });

  it('names a missing variable', () => {
    expect(() => loadWorkerEnv({ ...base, REDIS_URL: undefined })).toThrow(/REDIS_URL: missing/);
  });

  it('requires S3_* only for the s3 driver', () => {
    expect(() => loadWorkerEnv({ ...base, STORAGE_DRIVER: 's3' })).toThrow(/S3_BUCKET/);
    expect(loadWorkerEnv({ ...base, STORAGE_DRIVER: 's3', S3_ENDPOINT: 'http://h', S3_REGION: 'r', S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 'b', S3_BUCKET: 'c' }).S3_BUCKET).toBe('c');
  });

  it('rejects invalid variant widths', () => {
    expect(() => loadWorkerEnv({ ...base, MEDIA_IMAGE_VARIANT_WIDTHS: '320,abc' })).toThrow(/MEDIA_IMAGE_VARIANT_WIDTHS/);
  });
});

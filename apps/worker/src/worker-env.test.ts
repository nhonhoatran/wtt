import { describe, expect, it } from 'vitest';
import { loadWorkerEnv } from './worker-env.js';

const base = {
  APP_ENV: 'staging',
  TZ: 'UTC',
  DATABASE_URL: 'postgresql://u@h/db',
  REDIS_URL: 'redis://h:6379',
  QUEUE_PREFIX: 'kamito-tt:staging',
};

describe('loadWorkerEnv', () => {
  it('parses a valid env with defaults', () => {
    expect(loadWorkerEnv(base)).toMatchObject({ WORKER_HEALTH_PORT: 3010, LOG_LEVEL: 'info' });
  });

  it('rejects a prefix belonging to another environment', () => {
    expect(() => loadWorkerEnv({ ...base, QUEUE_PREFIX: 'kamito-tt:production' })).toThrow(/QUEUE_PREFIX/);
  });

  it('names a missing variable', () => {
    expect(() => loadWorkerEnv({ ...base, REDIS_URL: undefined })).toThrow(/REDIS_URL: missing/);
  });
});

import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { safeErrorSummary } from '@kamito/shared';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';

export const REDIS_CONNECTION = Symbol('REDIS_CONNECTION');

const logger = new Logger('Redis');
const READY_WAIT_MS = 5000;

/** Gives the first connect a bounded head start; boot continues (ready reports down) if Redis is away. */
function waitUntilReady(redis: Redis, timeoutMs: number): Promise<void> {
  if (redis.status === 'ready') return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      redis.off('ready', onReady);
      resolve();
    }, timeoutMs);
    const onReady = () => {
      clearTimeout(timer);
      resolve();
    };
    redis.once('ready', onReady);
  });
}

export const redisConnectionProvider = {
  provide: REDIS_CONNECTION,
  inject: [API_ENV],
  useFactory: async (env: ApiEnv) => {
    // No offline queue: commands fail fast while Redis is down instead of piling up.
    const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, enableOfflineQueue: false });
    redis.on('error', (error) => logger.error({ msg: 'redis connection error', err: safeErrorSummary(error) }));
    await waitUntilReady(redis, READY_WAIT_MS);
    return redis;
  },
};

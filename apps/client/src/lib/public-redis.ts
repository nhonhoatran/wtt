import { Redis } from 'ioredis';

let connection: Redis | undefined;
let warned = false;

/** Lazy: builds do not need runtime credentials or a Redis connection. */
export function publicRedis(): Redis | null {
  if (!process.env.REDIS_URL || !process.env.QUEUE_PREFIX) return null;
  if (!connection) {
    connection = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      // Allow the initial connection; the command deadline also bounds queued commands during an outage.
      enableOfflineQueue: true,
      connectTimeout: Number(process.env.API_FETCH_TIMEOUT_MS ?? 5000),
      commandTimeout: Number(process.env.API_FETCH_TIMEOUT_MS ?? 5000),
    });
    connection.on('error', warnPublicRedis);
  }
  return connection;
}

export function publicRedisPrefix(): string {
  if (!process.env.QUEUE_PREFIX) throw new Error('Missing environment variable QUEUE_PREFIX');
  return `${process.env.QUEUE_PREFIX}:public:v1`;
}

/** Avoid logging Redis URLs, command arguments, or one warning per visitor. */
export function warnPublicRedis(): void {
  if (warned) return;
  warned = true;
  console.warn('public-redis: shared cache unavailable; reads bypass cache and rate limits use local fallback');
}

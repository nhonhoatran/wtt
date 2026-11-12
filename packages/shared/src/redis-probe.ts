import { Redis } from 'ioredis';
import { parseConfigGetReply } from './redis-eviction-policy.js';

export type PolicyProbeResult =
  | { reachable: true; policy: string | undefined }
  | { reachable: false; error: string };

/**
 * Reads maxmemory-policy over a short-lived connection that fails fast,
 * so an unreachable Redis surfaces as an error instead of hanging boot.
 */
export async function probeRedisEvictionPolicy(redisUrl: string, timeoutMs = 5000): Promise<PolicyProbeResult> {
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: timeoutMs,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });
  redis.on('error', () => undefined);
  try {
    await redis.connect();
    try {
      return { reachable: true, policy: parseConfigGetReply(await redis.config('GET', 'maxmemory-policy')) };
    } catch {
      return { reachable: true, policy: undefined };
    }
  } catch (error) {
    return { reachable: false, error: error instanceof Error ? error.message : 'connection failed' };
  } finally {
    redis.disconnect();
  }
}

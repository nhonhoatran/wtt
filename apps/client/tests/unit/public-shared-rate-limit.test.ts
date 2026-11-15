import { existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ connections: [] as Redis[], next: 0, prefix: '' }));
vi.mock('../../src/lib/public-redis', () => ({
  publicRedis: () => state.connections[state.next++ % 2],
  publicRedisPrefix: () => state.prefix,
  warnPublicRedis: vi.fn(),
}));
import { sharedRateLimitRetryAfter } from '../../src/lib/public-shared-rate-limit';

if (!process.env.REDIS_URL && existsSync('../../.env')) process.loadEnvFile('../../.env');
beforeAll(async () => {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL required for shared rate limit integration');
  state.prefix = `test-shared-rate:${randomUUID()}`;
  state.connections = [new Redis(process.env.REDIS_URL), new Redis(process.env.REDIS_URL)];
  await Promise.all(state.connections.map((redis) => redis.ping()));
});
afterAll(async () => {
  const redis = state.connections[0];
  if (redis) {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `${state.prefix}:*`, 'COUNT', 100);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== '0');
  }
  await Promise.all(state.connections.map((redis) => redis.quit()));
});
const config = { windowSeconds: 10, maxRequests: 3, searchMaxRequests: 1, maxTrackedIps: 2 };

it('shares atomic page counts across two independent Redis connections under simultaneous requests', async () => {
  const results = await Promise.all(Array.from({ length: 8 }, () => sharedRateLimitRetryAfter('192.0.2.1', false, config)));
  expect(results.filter((result) => result === null)).toHaveLength(3);
  expect(results.filter((result) => typeof result === 'number' && result > 0)).toHaveLength(5);
});

it('counts search and ordinary pages together while limiting searches independently', async () => {
  expect(await sharedRateLimitRetryAfter('192.0.2.2', true, config)).toBeNull();
  expect(await sharedRateLimitRetryAfter('192.0.2.2', true, config)).toBeGreaterThan(0);
  expect(await sharedRateLimitRetryAfter('192.0.2.2', false, config)).toBeNull();
  expect(await sharedRateLimitRetryAfter('192.0.2.2', false, config)).toBeGreaterThan(0);
  // Both admitted IPs retain their counters; the configurable visitor cap fails open for a third one.
  for (let index = 0; index < 5; index++) expect(await sharedRateLimitRetryAfter('192.0.2.3', false, config)).toBeNull();
  expect(await sharedRateLimitRetryAfter('192.0.2.1', false, config)).toBeGreaterThan(0);
});

it('evicts expired visitor registry scores before enforcing the memory cap', async () => {
  const redis = state.connections[0]!;
  const visitors = `${state.prefix}:rate:visitors`;
  await redis.del(visitors);
  const expired = createHash('sha256').update('192.0.2.4').digest('hex');
  const [seconds] = await redis.time();
  await redis.zadd(visitors, '0', expired, String(Number(seconds) * 1000 + 60_000), 'live-key', String(Number(seconds) * 1000 + 60_000), 'live-key-2');
  // Redis TIME is used by the Lua script, so score zero is expired regardless of wall-clock skew.
  expect(await sharedRateLimitRetryAfter('192.0.2.4', false, config)).toBeNull();
  const members = await redis.zrange(visitors, '0', '-1');
  expect(members).not.toContain(expired);
  expect(members).toHaveLength(2);
});

import { createHash, randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { publicRedis, publicRedisPrefix, warnPublicRedis } from './public-redis';

const READ = `
local generation = redis.call('GET', KEYS[1]) or '0'
local entry = redis.call('GET', KEYS[2])
if not entry then return {generation, ''} end
local decoded = cjson.decode(entry)
for tag, version in pairs(decoded.versions) do
  if (redis.call('GET', ARGV[1] .. tag) or '0') ~= version then return {generation, ''} end
end
return {generation, entry}`;

const WRITE = `
if (redis.call('GET', KEYS[1]) or '0') ~= ARGV[1] then return 0 end
local versions = {}
for i=5,#ARGV do versions[ARGV[i]] = redis.call('GET', ARGV[4] .. ARGV[i]) or '0' end
redis.call('SET', KEYS[2], cjson.encode({payload=ARGV[2], versions=versions}), 'PX', ARGV[3])
return 1`;

/** Shared JSON responses only; Next's persistent per-instance fetch cache is deliberately bypassed. */
export class PublicResponseCache {
  constructor(private readonly redis: Redis, private readonly prefix: string) {}

  private keys(key: string) { return [`${this.prefix}:generation`, `${this.prefix}:response:${createHash('sha256').update(key).digest('hex')}`]; }

  async read(key: string): Promise<{ generation: string; payload?: string }> {
    const [generation, entry] = await this.redis.eval(READ, 2, ...this.keys(key), `${this.prefix}:tag:`) as [string, string];
    return entry ? { generation, payload: (JSON.parse(entry) as { payload: string }).payload } : { generation };
  }

  async write(key: string, payload: string, tags: string[], ttlMs: number, generation: string): Promise<void> {
    // A tag changed during the upstream fetch: do not let that older response repopulate any replica's cache.
    await this.redis.eval(WRITE, 2, ...this.keys(key), generation, payload, ttlMs, `${this.prefix}:tag:`, ...tags);
  }

  async invalidate(tags: string[]): Promise<void> {
    await this.redis.eval(`
      redis.call('SET', KEYS[1], ARGV[1])
      for i=3,#ARGV do redis.call('SET', ARGV[2] .. ARGV[i], ARGV[1]) end
      return 1`, 1, `${this.prefix}:generation`, randomUUID(), `${this.prefix}:tag:`, ...tags);
  }
}

export function sharedPublicCache(): PublicResponseCache | null {
  const redis = publicRedis();
  return redis ? new PublicResponseCache(redis, publicRedisPrefix()) : null;
}

export async function invalidatePublicResponses(tags: string[]): Promise<void> {
  const cache = sharedPublicCache();
  if (!cache) throw new Error('Shared public cache is not configured');
  try { await cache.invalidate(tags); }
  catch (error) { warnPublicRedis(); throw error; }
}

import { createHash } from 'node:crypto';
import type { PublicSiteConfig } from '@kamito/shared';
import { publicRedis, publicRedisPrefix, warnPublicRedis } from './public-redis';

// One atomic operation applies page and search counters across all client replicas.
const HIT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
local admitted = redis.call('ZSCORE', KEYS[1], ARGV[1])
if not admitted and redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then return 0 end
local page = redis.call('INCR', KEYS[2])
if page == 1 then redis.call('PEXPIRE', KEYS[2], ARGV[4]) end
local retry = 0
if page > tonumber(ARGV[5]) then retry = redis.call('PTTL', KEYS[2]) end
local searchTTL = 0
if ARGV[6] == '1' then
  local search = redis.call('INCR', KEYS[3])
  if search == 1 then redis.call('PEXPIRE', KEYS[3], ARGV[4]) end
  searchTTL = redis.call('PTTL', KEYS[3])
  if search > tonumber(ARGV[7]) then retry = math.max(retry, searchTTL) end
else searchTTL = redis.call('PTTL', KEYS[3]) end
local ttl = math.max(redis.call('PTTL', KEYS[2]), searchTTL)
redis.call('ZADD', KEYS[1], now + ttl, ARGV[1])
redis.call('PEXPIRE', KEYS[1], math.max(ttl, redis.call('PTTL', KEYS[1])))
return math.ceil(math.max(0, retry) / 1000)`;

/** undefined means Redis unavailable; null means admitted without a retry delay. */
export async function sharedRateLimitRetryAfter(ip: string, searching: boolean, config: PublicSiteConfig['rateLimit']): Promise<number | null | undefined> {
  const redis = publicRedis();
  if (!redis) return undefined;
  const prefix = `${publicRedisPrefix()}:rate`;
  const key = createHash('sha256').update(ip).digest('hex');
  try {
    const seconds = Number(await redis.eval(HIT, 3, `${prefix}:visitors`, `${prefix}:page:${key}`, `${prefix}:search:${key}`,
      key, Date.now(), config.maxTrackedIps, config.windowSeconds * 1000, config.maxRequests, searching ? '1' : '0', config.searchMaxRequests));
    return seconds > 0 ? seconds : null;
  } catch { warnPublicRedis(); return undefined; }
}

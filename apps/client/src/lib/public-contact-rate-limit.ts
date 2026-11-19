import { createHash } from 'node:crypto';
import type { PublicSiteConfig } from '@kamito/shared';
import { publicRedis, publicRedisPrefix, warnPublicRedis } from './public-redis';
import { rateLimitKey } from './public-rate-limit';

const HIT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
if count > tonumber(ARGV[2]) then return math.ceil(math.max(0, redis.call('PTTL', KEYS[1])) / 1000) end
return 0`;

const fallback = new Map<string, { count: number; resetAt: number }>();
let warned = false;

/** Uses dynamic contact limits and a shared Redis counter; falls back to a bounded local window if Redis is down. */
export async function contactRateLimitRetryAfter(ip: string, limits: PublicSiteConfig['contactRateLimit']): Promise<number | null> {
  const key = rateLimitKey(ip);
  if (key === 'unknown') return null;
  const redis = publicRedis();
  if (redis) {
    const digest = createHash('sha256').update(key).digest('hex');
    try {
      const seconds = Number(await redis.eval(HIT, 1, `${publicRedisPrefix()}:contact:${digest}`, limits.windowSeconds * 1000, limits.maxRequests));
      return seconds > 0 ? seconds : null;
    } catch {
      warnPublicRedis();
    }
  }
  if (!warned) {
    warned = true;
    console.warn('contact-rate-limit: using process-local fallback');
  }
  const now = Date.now();
  for (const [visitor, bucket] of fallback) if (bucket.resetAt <= now) fallback.delete(visitor);
  if (fallback.size >= 10_000 && !fallback.has(key)) return null;
  const current = fallback.get(key);
  if (!current || current.resetAt <= now) {
    fallback.set(key, { count: 1, resetAt: now + limits.windowSeconds * 1000 });
    return null;
  }
  current.count += 1;
  return current.count > limits.maxRequests ? Math.max(1, Math.ceil((current.resetAt - now) / 1000)) : null;
}

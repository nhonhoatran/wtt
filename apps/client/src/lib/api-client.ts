import { API_GLOBAL_PREFIX, PUBLIC_API_SEGMENT, SSR_SECRET_HEADER } from '@kamito/shared';
import { revalidateSeconds, type CachePolicy } from './cache-policy';
import { serverEnv } from './server-env';
import { sharedPublicCache } from './public-response-cache';
import { warnPublicRedis } from './public-redis';

export interface PublicGetOptions {
  tags: string[];
  policy: CachePolicy;
}

/**
 * Server-only read of the public API. `data: null` (content missing or not public) comes back as null so
 * the page calls notFound(); that answer is a cached 200, so a taken-down page also expires on its TTL.
 */
export async function publicGet<T>(path: string, { tags, policy }: PublicGetOptions): Promise<T | null> {
  const base = serverEnv.apiInternalUrl().replace(/\/+$/, '');
  const ttlMs = policy === 'none' ? 0 : revalidateSeconds(policy) * 1000;
  const cache = ttlMs ? sharedPublicCache() : null;
  const key = `${base}:${path}:${policy}:${[...tags].sort().join(',')}`;
  let generation: string | undefined;
  if (cache) {
    try {
      const cached = await cache.read(key);
      generation = cached.generation;
      if (cached.payload !== undefined) return JSON.parse(cached.payload) as T | null;
    } catch { warnPublicRedis(); }
  }
  const response = await fetch(`${base}/${API_GLOBAL_PREFIX}/${PUBLIC_API_SEGMENT}${path}`, {
    headers: { [SSR_SECRET_HEADER]: serverEnv.ssrSecret() },
    cache: 'no-store',
    signal: AbortSignal.timeout(serverEnv.apiTimeoutMs()),
  });
  if (!response.ok) throw new Error(`public API ${path} answered ${response.status}`);
  const data = ((await response.json()) as { data: T | null }).data;
  if (cache && generation !== undefined) {
    try { await cache.write(key, JSON.stringify(data), tags, ttlMs, generation); }
    catch { warnPublicRedis(); }
  }
  return data;
}

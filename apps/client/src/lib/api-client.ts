import { API_GLOBAL_PREFIX, PUBLIC_API_SEGMENT, SSR_SECRET_HEADER } from '@kamito/shared';
import { revalidateSeconds, type CachePolicy } from './cache-policy';
import { serverEnv } from './server-env';

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
  const response = await fetch(`${base}/${API_GLOBAL_PREFIX}/${PUBLIC_API_SEGMENT}${path}`, {
    headers: { [SSR_SECRET_HEADER]: serverEnv.ssrSecret() },
    cache: 'force-cache',
    next: { tags, revalidate: revalidateSeconds(policy) },
    signal: AbortSignal.timeout(serverEnv.apiTimeoutMs()),
  });
  if (!response.ok) throw new Error(`public API ${path} answered ${response.status}`);
  return ((await response.json()) as { data: T | null }).data;
}

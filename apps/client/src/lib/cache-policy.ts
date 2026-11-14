import { serverEnv } from './server-env';

/** `none` = never cached (pages driven by a free-text search). */
export type CachePolicy = 'standard' | 'matchday' | 'none';

/**
 * Tag revalidation is the main refresh path; the TTL is only the fallback when a revalidate call is lost.
 * Pages whose content changes during play (draws, matches) use the short matchday TTL.
 */
export function revalidateSeconds(policy: Exclude<CachePolicy, 'none'>): number {
  return policy === 'matchday' ? serverEnv.matchdayRevalidateSeconds() : serverEnv.publicRevalidateSeconds();
}

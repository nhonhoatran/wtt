import { serverEnv } from './server-env';

export type CachePolicy = 'standard' | 'matchday';

/**
 * Tag revalidation is the main refresh path; the TTL is only the fallback when a revalidate call is lost.
 * Pages whose content changes during play (draws, matches) use the short matchday TTL.
 */
export function revalidateSeconds(policy: CachePolicy): number {
  return policy === 'matchday' ? serverEnv.matchdayRevalidateSeconds() : serverEnv.publicRevalidateSeconds();
}

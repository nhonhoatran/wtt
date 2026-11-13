import { isValidCacheTag, REVALIDATE_MAX_TAGS, REVALIDATE_SECRET_HEADER } from '@kamito/shared';

export interface RevalidateDeps {
  clientInternalUrl: string;
  secret: string;
  timeoutMs: number;
  fetch?: typeof fetch;
}

/** Thrown for input that no retry can fix; the worker marks the job failed without retrying. */
export class PermanentRevalidateError extends Error {}

/**
 * Asks the client app to expire the given cache tags. Any non-2xx or network error throws so BullMQ
 * retries with backoff; pages still refresh on their own TTL if every attempt fails.
 */
export async function revalidateTags(deps: RevalidateDeps, tags: unknown): Promise<{ tags: number }> {
  if (!Array.isArray(tags) || !tags.length || tags.length > REVALIDATE_MAX_TAGS || !tags.every(isValidCacheTag)) throw new PermanentRevalidateError('invalid tags payload');
  const doFetch = deps.fetch ?? fetch;
  const response = await doFetch(new URL('/api/revalidate', deps.clientInternalUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json', [REVALIDATE_SECRET_HEADER]: deps.secret },
    body: JSON.stringify({ tags }),
    signal: AbortSignal.timeout(deps.timeoutMs),
  });
  if (!response.ok) throw new Error(`revalidate route answered ${response.status}`);
  return { tags: tags.length };
}

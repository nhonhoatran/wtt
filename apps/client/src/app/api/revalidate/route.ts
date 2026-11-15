import { revalidateTag } from 'next/cache';
import { isValidCacheTag, REVALIDATE_MAX_TAGS, REVALIDATE_SECRET_HEADER } from '@kamito/shared';
import { isInternalHost, isRevalidateSecret } from '../../../lib/internal-request';
import { invalidatePublicResponses } from '../../../lib/public-response-cache';

export const dynamic = 'force-dynamic';

const notFound = () => new Response(null, { status: 404 });

/** Called by the worker only. `{ expire: 0 }` makes the very next request render fresh data (Spike E). */
export async function POST(request: Request) {
  if (!isInternalHost(request.headers.get('host'))) return notFound();
  if (!isRevalidateSecret(request.headers.get(REVALIDATE_SECRET_HEADER))) return new Response(null, { status: 403 });

  const body: unknown = await request.json().catch(() => null);
  const tags = body && typeof body === 'object' && 'tags' in body ? body.tags : null;
  if (!Array.isArray(tags) || !tags.length || tags.length > REVALIDATE_MAX_TAGS || !tags.every(isValidCacheTag)) {
    return Response.json({ error: 'invalid tags' }, { status: 400 });
  }
  const unique = new Set(tags);
  // Tag versions persist: changing TTL settings must never resurrect an older response.
  try { await invalidatePublicResponses([...unique]); }
  catch { return new Response(null, { status: 503, headers: { 'Retry-After': '1', 'Cache-Control': 'no-store' } }); }
  for (const tag of unique) revalidateTag(tag, { expire: 0 });
  return Response.json({ revalidated: unique.size });
}

export const GET = notFound;

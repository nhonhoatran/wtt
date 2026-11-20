import { loadSitemapEntries } from '../../../lib/sitemap';
import { SITEMAP_LIMITS, sitemapChunkId, sitemapDocuments, sitemapXmlResponse } from '../../../lib/sitemap-xml';

export const dynamic = 'force-dynamic';
const missingChunk = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = sitemapChunkId((await params).id);
  if (id === null || id >= SITEMAP_LIMITS.maxUrls) return missingChunk();
  const entries = await loadSitemapEntries();
  // Every non-empty chunk contains at least one URL; reject impossible indices before XML allocation.
  if (id >= Math.max(1, entries.length)) return missingChunk();
  const xml = sitemapDocuments(entries)[id];
  return xml === undefined ? missingChunk() : sitemapXmlResponse(xml);
}

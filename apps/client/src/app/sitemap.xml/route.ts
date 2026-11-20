import { loadSitemapEntries } from '../../lib/sitemap';
import { sitemapDocuments, sitemapIndex, sitemapXmlResponse } from '../../lib/sitemap-xml';
import { serverEnv } from '../../lib/server-env';

// Build per request: neither the API nor runtime configuration is needed by the Docker build.
export const dynamic = 'force-dynamic';

export async function GET() {
  const documents = sitemapDocuments(await loadSitemapEntries());
  return sitemapXmlResponse(documents.length === 1 ? documents[0]! : sitemapIndex(serverEnv.publicSiteUrl(), documents.length));
}

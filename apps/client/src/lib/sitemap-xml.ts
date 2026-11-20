export interface SitemapEntry {
  url: string;
  lastModified?: string;
  alternates?: { languages: Record<string, string> };
}

// The sitemap protocol caps uncompressed XML at 50,000 locs and 50 MiB.
export const SITEMAP_LIMITS = { maxUrls: 50_000, maxBytes: 50 * 1024 * 1024 } as const;
type SitemapLimits = { maxUrls: number; maxBytes: number };
const XML = '<?xml version="1.0" encoding="UTF-8"?>\n';
const URLSET_START = `${XML}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;
const URLSET_END = '</urlset>\n';
const INDEX_START = `${XML}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
const INDEX_END = '</sitemapindex>\n';

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function serializeEntry(entry: SitemapEntry): string {
  const languages = Object.entries(entry.alternates?.languages ?? {}).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return `<url><loc>${escapeXml(entry.url)}</loc>${entry.lastModified ? `<lastmod>${escapeXml(entry.lastModified)}</lastmod>` : ''}${languages.map(([locale, url]) => `<xhtml:link rel="alternate" hreflang="${escapeXml(locale)}" href="${escapeXml(url)}"/>`).join('')}</url>\n`;
}

export function sitemapDocuments(entries: readonly SitemapEntry[], limits: SitemapLimits = SITEMAP_LIMITS): string[] {
  if (!Number.isInteger(limits.maxUrls) || limits.maxUrls < 1 || !Number.isInteger(limits.maxBytes) || limits.maxBytes < 1) throw new RangeError('Invalid sitemap limits');
  const overhead = Buffer.byteLength(URLSET_START + URLSET_END);
  const documents: string[] = [];
  let rows: string[] = [];
  let bytes = overhead;
  const flush = () => {
    documents.push(URLSET_START + rows.join('') + URLSET_END);
    rows = [];
    bytes = overhead;
  };
  const sorted = [...entries].sort((a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
  for (const entry of sorted) {
    const row = serializeEntry(entry);
    const size = Buffer.byteLength(row);
    if (overhead + size > limits.maxBytes) throw new RangeError('A sitemap URL exceeds the document byte limit');
    if (rows.length && (rows.length >= limits.maxUrls || bytes + size > limits.maxBytes)) flush();
    rows.push(row);
    bytes += size;
  }
  if (rows.length || documents.length === 0) {
    if (bytes > limits.maxBytes) throw new RangeError('Sitemap XML exceeds the document byte limit');
    flush();
  }
  return documents;
}

export function sitemapIndex(baseUrl: string, count: number, limits: SitemapLimits = SITEMAP_LIMITS): string {
  if (!Number.isSafeInteger(count) || count < 1 || count > limits.maxUrls) throw new RangeError('Sitemap index exceeds the document URL limit');
  const base = baseUrl.replace(/\/+$/, '');
  const rows = Array.from({ length: count }, (_, id) => `<sitemap><loc>${escapeXml(`${base}/sitemap/${id}.xml`)}</loc></sitemap>\n`);
  const result = INDEX_START + rows.join('') + INDEX_END;
  if (Buffer.byteLength(result) > limits.maxBytes) throw new RangeError('Sitemap index exceeds the document byte limit');
  return result;
}

export function sitemapChunkId(segment: string): number | null {
  if (!/^(0|[1-9]\d*)\.xml$/.test(segment)) return null;
  const id = Number(segment.slice(0, -4));
  return Number.isSafeInteger(id) ? id : null;
}

export const sitemapXmlResponse = (xml: string) => new Response(xml, {
  headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' },
});

import { describe, expect, it } from 'vitest';
import { SITEMAP_LIMITS, sitemapChunkId, sitemapDocuments, sitemapIndex, type SitemapEntry } from '../../src/lib/sitemap-xml';

const entry = (id: number): SitemapEntry => ({ url: `https://example.test/en/events/${id}` });
const locCount = (xml: string) => xml.match(/<loc>/g)?.length ?? 0;

describe('sitemap XML limits', () => {
  it('splits after exactly 50,000 locs without dropping or duplicating URLs', () => {
    const docs = sitemapDocuments(Array.from({ length: SITEMAP_LIMITS.maxUrls + 1 }, (_, id) => entry(id)));
    expect(docs.map(locCount)).toEqual([50_000, 1]);
    expect(docs.every((xml) => Buffer.byteLength(xml) <= SITEMAP_LIMITS.maxBytes)).toBe(true);
    expect(locCount(sitemapIndex('https://example.test/', docs.length))).toBe(2);
    expect(sitemapIndex('https://example.test/', docs.length)).toContain('<loc>https://example.test/sitemap/1.xml</loc>');
  });

  it('accounts for escaped UTF-8 bytes and document wrappers when splitting', () => {
    const row = { url: 'https://example.test/vi/events/giải?q=a&b=c', alternates: { languages: { 'vi"': 'https://example.test/vi/events/giải' } } };
    const [one] = sitemapDocuments([row]);
    const oneBytes = Buffer.byteLength(one!);
    const docs = sitemapDocuments([row, row], { maxUrls: 50_000, maxBytes: oneBytes });
    expect(docs).toHaveLength(2);
    expect(docs.every((xml) => Buffer.byteLength(xml) === oneBytes)).toBe(true);
    expect(one).toContain('q=a&amp;b=c');
    expect(one).toContain('hreflang="vi&quot;"');
    expect(() => sitemapDocuments([row], { maxUrls: 50_000, maxBytes: oneBytes - 1 })).toThrow('byte limit');
  });

  it('keeps ordering deterministic and bounds index XML too', () => {
    expect(sitemapDocuments([entry(2), entry(1)])).toEqual(sitemapDocuments([entry(1), entry(2)]));
    expect(() => sitemapIndex('https://example.test', 2, { maxUrls: 1, maxBytes: 1024 })).toThrow('URL limit');
    expect(() => sitemapIndex('https://example.test', 2, { maxUrls: 50_000, maxBytes: 64 })).toThrow('byte limit');
  });

  it('accepts only canonical safe chunk identifiers', () => {
    expect(sitemapChunkId('0.xml')).toBe(0);
    expect(sitemapChunkId('123.xml')).toBe(123);
    for (const id of ['01.xml', '-1.xml', 'x.xml', '0', '0.XML', '9007199254740992.xml']) expect(sitemapChunkId(id)).toBeNull();
  });
});

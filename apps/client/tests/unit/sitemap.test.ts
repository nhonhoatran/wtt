import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSitemap, getRankings } = vi.hoisted(() => ({ getSitemap: vi.fn(), getRankings: vi.fn() }));
vi.mock('../../src/lib/public-data', () => ({ getSitemap, getRankings }));
vi.mock('../../src/lib/server-env', () => ({ serverEnv: { publicSiteUrl: () => 'https://example.test/' } }));
import { loadSitemapEntries } from '../../src/lib/sitemap';
import { GET as sitemapRoot, dynamic } from '../../src/app/sitemap.xml/route';
import { GET as sitemapChunk } from '../../src/app/sitemap/[id]/route';
import * as sitemapXml from '../../src/lib/sitemap-xml';

beforeEach(() => {
  getSitemap.mockResolvedValue({ events: [], articles: [], pages: [], videos: [], matches: [] });
  getRankings.mockResolvedValue({ items: [] });
});

describe('runtime sitemap', () => {
  it('emits every public route in both locales with self-consistent alternates', async () => {
    getSitemap.mockResolvedValue({
      events: [{
        slug: 'open', updatedAt: '2026-11-19T00:00:00Z', tabs: { matches: true, info: true },
        subEvents: [
          { code: 'MS', drawKinds: ['MAIN', 'QUALIFYING'], hasGroups: false, entryCount: 3 },
          { code: 'WD', drawKinds: [], hasGroups: true, entryCount: 0 },
        ],
      }],
      articles: [{ slug: 'story', updatedAt: '2026-11-19T00:00:00Z' }],
      pages: [{ slug: 'about', updatedAt: '2026-11-19T00:00:00Z' }],
      videos: [{ slug: 'final', updatedAt: '2026-11-19T00:00:00Z' }],
      matches: [{ eventSlug: 'open', matchNo: 12, updatedAt: '2026-11-19T00:00:00Z' }],
    });
    getRankings.mockResolvedValue({ items: [{ list: { code: 'MS' }, publishedAt: '2026-11-19T00:00:00Z' }] });

    const entries = await loadSitemapEntries();
    const urls = entries.map(({ url }) => url);
    for (const locale of ['vi', 'en']) {
      for (const path of ['/events/open', '/events/open/info', '/events/open/matches', '/events/open/draws/MS', '/events/open/draws/MS?draw=qualifying', '/events/open/groups/WD', '/events/open/players/MS', '/events/open/matches/12', '/news/story', '/pages/about', '/videos/final', '/rankings/MS']) {
        expect(urls).toContain(`https://example.test/${locale}${path}`);
      }
    }
    expect(urls).not.toContain('https://example.test/vi/events/open/players/WD');
    expect(urls.every((url) => !/\/(?:vi|en)\/players\//.test(url))).toBe(true);
    expect(entries.find(({ url }) => url === 'https://example.test/en/events/open')?.alternates?.languages).toEqual({
      vi: 'https://example.test/vi/events/open', en: 'https://example.test/en/events/open', 'x-default': 'https://example.test/vi/events/open',
    });
    expect(dynamic).toBe('force-dynamic');
  });

  it('never guesses event tab routes when no public capability is available', async () => {
    getSitemap.mockResolvedValue({ events: [{ slug: 'empty', updatedAt: '2026-11-19', tabs: { info: false, matches: false }, subEvents: [] }], articles: [], pages: [], videos: [], matches: [] });
    const urls = (await loadSitemapEntries()).map(({ url }) => url);
    expect(urls).toContain('https://example.test/vi/events/empty');
    expect(urls).not.toContain('https://example.test/vi/events/empty/info');
    expect(urls).not.toContain('https://example.test/vi/events/empty/matches');
  });

  it('serves XML at the root, rejects unknown chunks and avoids API calls for invalid ids', async () => {
    const root = await sitemapRoot();
    expect(root.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    expect(root.headers.get('Cache-Control')).toBe('no-store');
    expect(await root.text()).toContain('<urlset');
    getSitemap.mockClear();
    const request = new Request('https://example.test/sitemap/invalid');
    expect((await sitemapChunk(request, { params: Promise.resolve({ id: 'invalid' }) })).status).toBe(404);
    expect(getSitemap).not.toHaveBeenCalled();
    expect((await sitemapChunk(request, { params: Promise.resolve({ id: '99.xml' }) })).status).toBe(404);
    expect((await sitemapChunk(request, { params: Promise.resolve({ id: '0.xml' }) })).status).toBe(200);
  });

  it('automatically serves an index at the existing root URL when the URL set spans chunks', async () => {
    getSitemap.mockResolvedValue({
      events: [], articles: [], pages: [], matches: [],
      videos: Array.from({ length: 25_000 }, (_, id) => ({ slug: `video-${id}`, updatedAt: '2026-11-19' })),
    });
    const xml = await (await sitemapRoot()).text();
    expect(xml).toContain('<sitemapindex');
    expect(xml).toContain('<loc>https://example.test/sitemap/0.xml</loc>');
    expect(xml).toContain('<loc>https://example.test/sitemap/1.xml</loc>');
    expect(xml.match(/<sitemap>/g)).toHaveLength(2);
  });

  it('bounds impossible chunk ids before upstream and avoids building XML for an unknown id', async () => {
    getSitemap.mockClear();
    getRankings.mockClear();
    const request = new Request('https://example.test/sitemap/50000.xml');
    const impossible = await sitemapChunk(request, { params: Promise.resolve({ id: '50000.xml' }) });
    expect(impossible.status).toBe(404);
    expect(impossible.headers.get('cache-control')).toBe('no-store');
    expect(getSitemap).not.toHaveBeenCalled();
    expect(getRankings).not.toHaveBeenCalled();

    const serialize = vi.spyOn(sitemapXml, 'sitemapDocuments');
    try {
      const absent = await sitemapChunk(request, { params: Promise.resolve({ id: '99.xml' }) });
      expect(absent.status).toBe(404);
      expect(absent.headers.get('cache-control')).toBe('no-store');
      expect(serialize).not.toHaveBeenCalled();
    } finally { serialize.mockRestore(); }
  });
});

import { renderToReadableStream, renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicArticle, PublicFooter, PublicVideo } from '@kamito/shared';

const { getArticle, getVideo, getFooter, getArticles } = vi.hoisted(() => ({ getArticle: vi.fn(), getVideo: vi.fn(), getFooter: vi.fn(), getArticles: vi.fn() }));
vi.mock('../../src/lib/public-data', () => ({ getArticle, getVideo, getFooter, getArticles, isUrlPart: () => true }));
vi.mock('../../src/lib/site-name', () => ({ getSiteName: async () => 'Kamito' }));
vi.mock('../../src/lib/server-env', () => ({ serverEnv: { publicSiteUrl: () => 'https://example.test' } }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-nonce': 'localization-test-nonce' }) }));
import ArticlePage from '../../src/app/[locale]/news/[slug]/page';
import VideoPage from '../../src/app/[locale]/videos/[slug]/page';
import NewsPage from '../../src/app/[locale]/news/page';
import { SiteFooter } from '../../src/components/layout/site-footer';
import { getDictionary } from '../../src/i18n/get-dictionary';

const chromeDisplay = { navItems: [{ key: 'events' as const }], socialLinks: [], tagline: null, registrationUrl: '' };

// Request-aware Server Components can suspend; use the async renderer rather than a legacy sync root.
async function renderPage(node: ReactNode) {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  return new Response(stream).text();
}

const article: PublicArticle = {
  slug: 'news', title: 'Tin', titleEn: 'News', body: '<p>Nội dung</p>', bodyEn: '<p>Body</p>',
  summary: null, summaryEn: 'English-only summary', category: 'Tin giải', categoryEn: 'Tournament news',
  authorName: 'Editor', publishedAt: '2026-11-19T00:00:00Z', eventSlugs: [], cover: null,
};
const video: PublicVideo = {
  slug: 'final', title: 'Chung kết', titleEn: 'Final', provider: 'youtube', embedId: 'Abcdef_1234',
  url: 'https://www.youtube.com/watch?v=Abcdef_1234', thumbnailUrl: null,
  durationText: '4 phút', durationTextEn: '4 minutes', publishedAt: '2026-11-19T00:00:00Z', eventSlug: null,
};
beforeEach(() => {
  getArticle.mockResolvedValue(article);
  getVideo.mockResolvedValue(video);
  getFooter.mockResolvedValue({ pages: [{ slug: 'about', title: 'Giới thiệu', titleEn: 'About', group: 'Thông tin', groupEn: 'Information', order: 0 }], sponsors: [] } satisfies PublicFooter);
});

describe('public CMS localization', () => {
  it('renders an English-only summary and translated category in article detail', async () => {
    const html = await renderPage(await ArticlePage({ params: Promise.resolve({ locale: 'en', slug: 'news' }) }));
    expect(html).toContain('>English-only summary</p>');
    expect(html).toContain('>Tournament news</span>');
    expect(html).not.toContain('>Tin giải</span>');
  });

  it('uses English video duration and footer labels with Vietnamese fallback', async () => {
    const enVideo = await renderPage(await VideoPage({ params: Promise.resolve({ locale: 'en', slug: 'final' }) }));
    expect(enVideo).toContain('>4 minutes</p>');
    expect(renderToStaticMarkup(await SiteFooter({ locale: 'en', siteName: 'Kamito', t: getDictionary('en'), display: chromeDisplay }))).toContain('>Information</h2>');
    getVideo.mockResolvedValue({ ...video, durationTextEn: null });
    getFooter.mockResolvedValue({ pages: [{ slug: 'about', title: 'Giới thiệu', titleEn: null, group: 'Thông tin', groupEn: null, order: 0 }], sponsors: [] });
    expect(await renderPage(await VideoPage({ params: Promise.resolve({ locale: 'en', slug: 'final' }) }))).toContain('>4 phút</p>');
    expect(renderToStaticMarkup(await SiteFooter({ locale: 'en', siteName: 'Kamito', t: getDictionary('en'), display: chromeDisplay }))).toContain('>Thông tin</h2>');
  });

  it('translates news filter labels without changing the submitted category value', async () => {
    getArticles.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 12, categories: ['tin-giai'], categoryLabelsEn: { 'tin-giai': 'Tournament news' } });
    const html = renderToStaticMarkup(await NewsPage({ params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve({ category: 'tin-giai' }) }));
    expect(html).toContain('value="tin-giai"');
    expect(html).toContain('>Tournament news</option>');
  });

  it('keeps inherited object keys as category fallback labels', async () => {
    getArticles.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 12, categories: ['__proto__', 'constructor'], categoryLabelsEn: {} });
    const html = renderToStaticMarkup(await NewsPage({ params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve({}) }));
    expect(html).toContain('value="__proto__">__proto__</option>');
    expect(html).toContain('value="constructor">constructor</option>');
  });
});

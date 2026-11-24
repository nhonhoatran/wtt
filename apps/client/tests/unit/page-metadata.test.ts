import { describe, expect, it } from 'vitest';
import type { PublicEventDetail } from '@kamito/shared';
import { eventPageMetadata, pageMetadata } from '../../src/lib/page-metadata';

const event = {
  name: 'Giải bóng bàn', nameEn: 'Table tennis tournament', slug: 'open', shortName: null,
  startDate: '2026-11-19', endDate: '2026-11-20', timezone: 'Asia/Ho_Chi_Minh', lifecycle: 'UPCOMING',
  city: null, venue: null, tier: { code: 'OPEN', name: 'Mở rộng', nameEn: 'Open', colorHex: '#000000' },
  eventType: { code: 'SINGLES', name: 'Đơn', nameEn: 'Singles', colorHex: null }, banner: null,
  summary: '  Mô tả tiếng Việt  ', summaryEn: '  English description  ', presentedBy: null, ticketUrl: null,
  subEvents: [], tabs: { matches: false, draws: false, groups: false, players: false, info: false },
  stats: { players: 0, playedMatches: 0 }, champions: [],
} satisfies PublicEventDetail;

describe('pageMetadata', () => {
  it('provides canonical, locale alternates, Open Graph and Twitter metadata', () => {
    const metadata = pageMetadata('en', '/events/open', {
      title: 'Open tournament',
      description: 'Tournament details',
      image: { url: '/event.jpg', width: 1200, height: 630, alt: 'Giải đấu', altEn: 'Tournament' },
    });

    expect(metadata.alternates).toEqual({
      canonical: '/en/events/open',
      languages: { vi: '/vi/events/open', en: '/en/events/open', 'x-default': '/vi/events/open' },
    });
    expect(metadata.openGraph?.title).toBe('Open tournament');
    expect(metadata.openGraph?.images).toEqual([{ url: '/event.jpg', width: 1200, height: 630, alt: 'Tournament' }]);
    expect(metadata.twitter).toEqual({ card: 'summary_large_image', title: 'Open tournament', description: 'Tournament details', images: ['/event.jpg'] });
  });
});

describe('eventPageMetadata', () => {
  for (const locale of ['vi', 'en'] as const) {
    it.each([null, '', ' \n '])(`${locale} describes overview and draw pages when summaries are blank (%j)`, (summary) => {
      for (const [path, tab] of [['', undefined], ['/draws/MS', locale === 'vi' ? 'Nhánh đấu Đơn nam' : 'Draw Men singles']] as const) {
        const metadata = eventPageMetadata(locale, { ...event, summary, summaryEn: summary }, path, tab);
        const title = tab ? `${tab} · ${locale === 'vi' ? event.name : event.nameEn}` : locale === 'vi' ? event.name : event.nameEn;
        expect(metadata.title).toBe(title);
        expect(metadata.description).toEqual(expect.stringContaining(title));
        expect(metadata.openGraph?.description).toBe(metadata.description);
        expect(metadata.twitter?.description).toBe(metadata.description);
        expect(metadata.alternates?.canonical).toBe(`/${locale}/events/open${path}`);
      }
    });
  }

  it.each([null, '', ' \n '])('falls back from blank English summary to authored Vietnamese (%j)', (summaryEn) => {
    const metadata = eventPageMetadata('en', { ...event, summaryEn }, '');
    expect(metadata.description).toBe(event.summary);
  });

  it.each(['vi', 'en'] as const)('preserves the authored %s summary without rewriting it', (locale) => {
    const metadata = eventPageMetadata(locale, event, '');
    const summary = locale === 'vi' ? event.summary : event.summaryEn;
    expect(metadata.description).toBe(summary);
    expect(metadata.openGraph?.description).toBe(summary);
    expect(metadata.twitter?.description).toBe(summary);
  });
});

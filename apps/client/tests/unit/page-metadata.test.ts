import { describe, expect, it, vi } from 'vitest';
import type { PublicEventDetail, PublicMatchDetail } from '@kamito/shared';
const { getMatch } = vi.hoisted(() => ({ getMatch: vi.fn() }));
vi.mock('../../src/lib/public-data', () => ({ getMatch, isUrlPart: () => true }));
import { generateMetadata as matchPageMetadata } from '../../src/app/[locale]/events/[slug]/matches/[matchNo]/page';
import { eventPageMetadata, pageMetadata } from '../../src/lib/page-metadata';

const event = {
  name: 'Giải bóng bàn', nameEn: 'Table tennis tournament', slug: 'open', shortName: null,
  startDate: '2026-11-19', endDate: '2026-11-20', timezone: 'Asia/Ho_Chi_Minh', lifecycle: 'UPCOMING',
  city: null, venue: null, tier: { code: 'OPEN', name: 'Mở rộng', nameEn: 'Open', colorHex: '#000000' },
  eventType: { code: 'SINGLES', name: 'Đơn', nameEn: 'Singles', colorHex: null }, banner: null,
  summary: '  Mô tả tiếng Việt  ', summaryEn: '  English description  ', presentedBy: null, ticketUrl: null,
  subEvents: [], hasPublicMatches: false, days: [], tabs: { matches: false, draws: false, groups: false, players: false, info: false },
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

describe('match page metadata', () => {
  const match = {
    matchNo: 9, status: 'OFFICIAL', subEvent: { name: 'Đơn nam', nameEn: 'Men singles' },
    event: { slug: 'open', name: event.name, nameEn: event.nameEn }, round: { code: 'SF', number: 2 }, groupCode: null,
    side1: { players: [{ name: 'Tên công khai', nameEn: 'Public display name' }] },
    side2: { players: [{ name: 'Đối thủ', nameEn: 'Opponent' }] },
  } as PublicMatchDetail;

  it.each(['vi', 'en'] as const)('describes the %s match in standard and social metadata', async (locale) => {
    getMatch.mockResolvedValue(match);
    const metadata = await matchPageMetadata({ params: Promise.resolve({ locale, slug: 'open', matchNo: '9' }) });
    for (const text of locale === 'vi'
      ? ['Tên công khai', 'Đối thủ', event.name, 'Đơn nam', 'Bán kết', 'Đã kết thúc']
      : ['Public display name', 'Opponent', event.nameEn, 'Men singles', 'Semifinals', 'Final']) {
      expect(metadata.description).toContain(text);
    }
    expect(metadata.openGraph?.description).toBe(metadata.description);
    expect(metadata.twitter?.description).toBe(metadata.description);
    expect(metadata.alternates?.canonical).toBe(`/${locale}/events/open/matches/9`);
  });

  it('describes an undecided group match without inventing a participant', async () => {
    getMatch.mockResolvedValue({ ...match, status: 'SCHEDULED', groupCode: 'A', side1: null, side2: null });
    const metadata = await matchPageMetadata({ params: Promise.resolve({ locale: 'en', slug: 'open', matchNo: '9' }) });
    expect(metadata.description).toContain('To be decided');
    expect(metadata.description).toContain('Group A');
    expect(metadata.description).toContain('Scheduled');
  });
});

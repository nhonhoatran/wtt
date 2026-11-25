import type { PublicEventDetail } from '@kamito/shared';
import { describe, expect, it } from 'vitest';
import { sportsEventStructuredData } from '../../src/lib/json-ld';

const event = {
  name: 'Giải bóng bàn',
  nameEn: 'Table tennis tournament',
  slug: 'open',
  shortName: null,
  startDate: '2026-11-19',
  endDate: '2026-11-20',
  timezone: 'Asia/Ho_Chi_Minh',
  lifecycle: 'UPCOMING',
  city: 'Ho Chi Minh City',
  venue: { name: 'Nhà thi đấu', nameEn: 'Sports hall', address: null, mapUrl: null },
  tier: { code: 'OPEN', name: 'Mở rộng', nameEn: 'Open', colorHex: '#000000' },
  eventType: { code: 'SINGLES', name: 'Đơn', nameEn: 'Singles', colorHex: null },
  banner: null,
  summary: 'Mô tả tiếng Việt',
  summaryEn: 'English description',
  presentedBy: null,
  ticketUrl: null,
  subEvents: [],
  days: [],
  hasPublicMatches: false,
  tabs: { matches: false, draws: false, groups: false, players: false, info: false },
  stats: { players: 0, playedMatches: 0 },
  champions: [],
} satisfies PublicEventDetail;

describe('sportsEventStructuredData', () => {
  it('localizes public event details and excludes participant identities', () => {
    const data = sportsEventStructuredData(event, 'en', 'https://example.test/en/events/open');

    expect(data).toMatchObject({
      '@type': 'SportsEvent',
      name: 'Table tennis tournament',
      startDate: '2026-11-19',
      endDate: '2026-11-20',
      description: 'English description',
      location: { name: 'Sports hall', address: { addressLocality: 'Ho Chi Minh City' } },
      url: 'https://example.test/en/events/open',
    });
    expect(JSON.stringify(data)).not.toContain('Person');
  });
});

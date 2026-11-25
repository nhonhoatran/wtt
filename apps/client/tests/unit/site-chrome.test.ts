import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicStripItem } from '@kamito/shared';

const { getResultsStrip, getFooter } = vi.hoisted(() => ({ getResultsStrip: vi.fn(), getFooter: vi.fn() }));
vi.mock('../../src/lib/public-data', () => ({ getResultsStrip, getFooter, isUrlPart: () => true }));
import { RegistrationButton } from '../../src/components/layout/registration-button';
import { ResultsStrip } from '../../src/components/layout/results-strip';
import { SiteFooter } from '../../src/components/layout/site-footer';
import { getDictionary } from '../../src/i18n/get-dictionary';

const player = (name: string, slug: string | null) => ({ name, nameEn: null, club: null, slug });
const item = (matchNo: number, slug: string, status: 'LIVE' | 'OFFICIAL'): PublicStripItem => ({
  matchNo, status, resultType: 'NORMAL', winnerSide: status === 'OFFICIAL' ? 1 : null, games1: 2, games2: 1, scheduledAt: null,
  table: { code: 'T1', displayName: null }, side1: { seed: null, quota: null, players: [player('An', 'an')] },
  side2: { seed: null, quota: null, players: [player('Bình', null)] }, side1Source: null, side2Source: null,
  games: [{ number: 1, score1: 11, score2: 7 }, { number: 2, score1: 8, score2: 11 }, { number: 3, score1: 11, score2: 9 }], voided: false,
  subEvent: { code: 'MS', name: 'Đơn nam', nameEn: 'Men singles' }, drawKind: 'MAIN', round: { code: 'SF', number: 2 }, groupCode: null,
  event: { slug, name: 'Giải A', nameEn: null },
});

beforeEach(() => {
  getResultsStrip.mockReset();
  getFooter.mockResolvedValue({ pages: [], sponsors: [] });
});

describe('ResultsStrip', () => {
  const t = getDictionary('vi');
  it('renders one link per card and no nested links', async () => {
    getResultsStrip.mockResolvedValue({ items: [item(7, 'a', 'LIVE'), item(8, 'a', 'OFFICIAL')] });
    const html = renderToStaticMarkup(await ResultsStrip({ locale: 'vi', t }));
    expect(html.match(/<a /g)).toHaveLength(3);
    expect(html).toContain('href="/vi/events/a/matches/7"');
    expect(html).toContain('href="/vi/events/a/matches"');
    expect(html).not.toContain('aria-label=');
    expect(html).toContain('visually-hidden">Trận #7. </span>');
    expect(html).toContain('MS · Bán kết · Bàn T1');
    expect(html).not.toContain('/players/');
  });
  it('omits the all-matches link when cards span several events', async () => {
    getResultsStrip.mockResolvedValue({ items: [item(1, 'a', 'LIVE'), item(1, 'b', 'LIVE')] });
    const html = renderToStaticMarkup(await ResultsStrip({ locale: 'vi', t }));
    expect(html.match(/<a /g)).toHaveLength(2);
  });
  it('renders nothing when empty or when the API fails', async () => {
    getResultsStrip.mockResolvedValue({ items: [] });
    expect(renderToStaticMarkup(await ResultsStrip({ locale: 'vi', t }))).toBe('');
    getResultsStrip.mockRejectedValue(new Error('down'));
    expect(renderToStaticMarkup(await ResultsStrip({ locale: 'vi', t }))).toBe('');
  });
});

describe('RegistrationButton', () => {
  it('is hidden without a URL and opens safely in a new tab with one', () => {
    expect(renderToStaticMarkup(RegistrationButton({ url: '', label: 'Đăng ký', newTabLabel: 'tab mới' }))).toBe('');
    const html = renderToStaticMarkup(RegistrationButton({ url: 'https://example.test/reg', label: 'Đăng ký', newTabLabel: 'tab mới' }));
    expect(html).toContain('href="https://example.test/reg"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('tab mới');
  });
});

describe('SiteFooter display settings', () => {
  const base = { siteName: 'Kamito', locale: 'en' as const, t: getDictionary('en') };
  it('shows tagline, social links and the configured explore items', async () => {
    const html = renderToStaticMarkup(await SiteFooter({
      ...base,
      display: {
        navItems: [{ key: 'rankings', labelEn: 'Leaderboard' }], registrationUrl: '',
        tagline: { vi: 'Giới thiệu', en: 'About us' }, socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/kamito' }],
      },
    }));
    expect(html).toContain('About us');
    expect(html).toContain('href="https://facebook.com/kamito"');
    expect(html).toContain('>Leaderboard</a>');
    expect(html).toContain('href="/en/contact"');
  });
  it('hides tagline and social block when unset and survives a failed footer fetch', async () => {
    getFooter.mockRejectedValue(new Error('down'));
    const html = renderToStaticMarkup(await SiteFooter({ ...base, display: { navItems: [{ key: 'events' }], registrationUrl: '', tagline: null, socialLinks: [] } }));
    expect(html).not.toContain('Social media');
    expect(html).toContain('©');
  });
});

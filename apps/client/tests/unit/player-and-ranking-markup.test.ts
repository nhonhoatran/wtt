import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PublicPlayerProfile, PublicPlayerResult, PublicRankingListInfo, PublicRankingTop } from '@kamito/shared';
import { PlayerHeroStats } from '../../src/components/players/player-hero-stats';
import { PlayerResultsTable } from '../../src/components/players/player-results-table';
import { RankingListSwitcher } from '../../src/components/rankings/ranking-list-switcher';
import { RankingPageHeader } from '../../src/components/rankings/ranking-page-header';
import { getDictionary } from '../../src/i18n/get-dictionary';

const t = getDictionary('vi');
const p = (slug: string | null, name: string) => ({ slug, name, nameEn: null, club: null });
const side = (...players: ReturnType<typeof p>[]) => ({ seed: null, quota: null, players });

const doubles = {
  matchNo: 9, status: 'OFFICIAL', resultType: 'NORMAL', winnerSide: 1, games1: 3, games2: 1, scheduledAt: null, officialAt: '2026-11-20T08:00:00.000Z',
  table: null, side1: side(p('p-a', 'An'), p('p-b', 'Bình')), side2: side(p('p-c', 'Chi'), p('p-d', 'Dũng')), side1Source: null, side2Source: null,
  games: [], voided: false, subEvent: { code: 'MD', name: 'Đôi nam', nameEn: null }, drawKind: 'MAIN', round: { code: 'SF', number: 2 }, groupCode: null,
  event: { slug: 'giai-a', name: 'Giải A', nameEn: null, timezone: 'Asia/Ho_Chi_Minh' },
} as unknown as PublicPlayerResult;

describe('player results table', () => {
  it('names the partner in doubles and omits the line in singles', () => {
    const html = renderToStaticMarkup(createElement(PlayerResultsTable, { items: [doubles], slug: 'p-a', locale: 'vi', t }));
    expect(html).toContain(t.players.profile.resultsTable.partner);
    expect(html).toContain('href="/vi/players/p-b"');
    expect(html).toContain('Chi');
    const singles = { ...doubles, side1: side(p('p-a', 'An')), side2: side(p('p-c', 'Chi')) } as PublicPlayerResult;
    const singlesHtml = renderToStaticMarkup(createElement(PlayerResultsTable, { items: [singles], slug: 'p-a', locale: 'vi', t }));
    expect(singlesHtml).not.toContain(t.players.profile.resultsTable.partner);
  });
});

describe('player hero rank', () => {
  it('reads "Hạng <list>" so the figure is announced as a rank', () => {
    const player = { ranks: [{ rank: 5, points: 120, list: { code: 'RL-1', name: 'Đơn nam', nameEn: 'Men singles' } }], record: { wins: 0, losses: 0 } } as unknown as PublicPlayerProfile;
    const html = renderToStaticMarkup(createElement(PlayerHeroStats, { player, locale: 'vi', t: t.players }));
    expect(html).toContain('<dt>Hạng Đơn nam</dt>');
  });
});

describe('ranking page header', () => {
  it('shows the points guide link only when a target is given', () => {
    const base = { locale: 'vi' as const, t, name: 'Đơn nam', updated: 'Cập nhật' };
    expect(renderToStaticMarkup(createElement(RankingPageHeader, base))).not.toContain(t.rankings.pointsGuide);
    const html = renderToStaticMarkup(createElement(RankingPageHeader, { ...base, guideHref: '/vi/pages/cach-tinh-diem' }));
    expect(html).toContain('href="/vi/pages/cach-tinh-diem"');
    expect(html).toContain(t.rankings.pointsGuide);
  });
});

describe('ranking list switcher', () => {
  const info = (code: string, kind: 'SINGLES' | 'DOUBLES') => ({ code, name: code, nameEn: code, competitorKind: kind }) as unknown as PublicRankingListInfo;
  const lists = ['A', 'B', 'C', 'D'].flatMap((c) => [info(`S-${c}`, 'SINGLES'), info(`D-${c}`, 'DOUBLES')]).map((list) => ({ list }) as unknown as PublicRankingTop);

  it('marks the kind tab as the current group and only the exact list as the current page', () => {
    const html = renderToStaticMarkup(createElement(RankingListSwitcher, { lists, current: info('S-C', 'SINGLES'), locale: 'vi', t: t.rankings }));
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain('aria-current="page" href="/vi/rankings/S-C"');
  });
});

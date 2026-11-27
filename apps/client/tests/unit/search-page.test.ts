import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { PUBLIC_SEARCH_MAX_LENGTH } from '@kamito/shared';

const { getEventList, getPlayerList } = vi.hoisted(() => ({ getEventList: vi.fn(), getPlayerList: vi.fn() }));
vi.mock('../../src/lib/public-data', () => ({ getEventList, getPlayerList }));
import SearchPage, { generateMetadata } from '../../src/app/[locale]/search/page';

const events = { items: [], total: 0, page: 1, pageSize: 20, filters: { tiers: [], eventTypes: [], years: [] } };
const players = { items: [], total: 0, page: 1, pageSize: 20, clubs: [] };
const props = (query: Record<string, string | string[] | undefined>, locale = 'vi') => ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) });
beforeEach(() => { vi.resetAllMocks(); getEventList.mockResolvedValue(events); getPlayerList.mockResolvedValue(players); });

it.each([{}, { q: '   ' }, { q: ['a', 'b'] }])('an empty or ambiguous query does not enumerate public lists: %j', async (query) => {
  const html = renderToStaticMarkup(await SearchPage(props(query)));
  expect(getEventList).not.toHaveBeenCalled();
  expect(getPlayerList).not.toHaveBeenCalled();
  expect(html).toContain('Nhập tên giải đấu hoặc vận động viên');
});

it('bounds and escapes search input and ignores unrelated URL filters', async () => {
  const text = `<script>${'tên &'.repeat(100)}`;
  const expected = `?${new URLSearchParams({ q: text.slice(0, PUBLIC_SEARCH_MAX_LENGTH) })}`;
  const html = renderToStaticMarkup(await SearchPage(props({ q: ` ${text} `, page: '9999', tier: 'private' })));
  expect(getEventList).toHaveBeenCalledWith(expected, true);
  expect(getPlayerList).toHaveBeenCalledWith(expected, true);
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
});

it('starts both public searches before either response completes', async () => {
  let finishEvents!: (value: typeof events) => void;
  let finishPlayers!: (value: typeof players) => void;
  getEventList.mockImplementation(() => new Promise((resolve) => { finishEvents = resolve; }));
  getPlayerList.mockImplementation(() => new Promise((resolve) => { finishPlayers = resolve; }));
  const pending = SearchPage(props({ q: 'Nguyễn' }));
  await vi.waitFor(() => { expect(getEventList).toHaveBeenCalledOnce(); expect(getPlayerList).toHaveBeenCalledOnce(); });
  finishEvents(events); finishPlayers(players);
  expect(renderToStaticMarkup(await pending)).toContain('Không tìm thấy vận động viên');
});

it('keeps the other result section usable when one API is unavailable', async () => {
  getEventList.mockRejectedValue(new Error('unavailable'));
  const html = renderToStaticMarkup(await SearchPage(props({ q: 'Open' }, 'en')));
  expect(html).toContain('Results could not be loaded');
  expect(html).toContain('No matching players found');
  expect(html).toContain('/en/players?q=Open');
});

it.each(['vi', 'en'])('search metadata has a stable %s canonical, language alternates and noindex', async (locale) => {
  const metadata = await generateMetadata(props({ q: 'private query', page: '2' }, locale));
  expect(metadata.alternates?.canonical).toBe(`/${locale}/search`);
  expect(metadata.robots).toEqual({ index: false, follow: true });
  expect(metadata.alternates?.languages).toMatchObject({ vi: '/vi/search', en: '/en/search' });
  expect(JSON.stringify(metadata)).not.toContain('private query');
});

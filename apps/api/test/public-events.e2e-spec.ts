import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { cleanupPublicWorld, privateProfile, publicGet, type PublicWorld, setupPublicWorld, sortedPaths } from './support/public-api-kit.js';
import { API } from './support/entries-fixtures.js';

const CARD_KEYS = [
  'slug', 'name', 'nameEn', 'shortName', 'startDate', 'endDate', 'timezone', 'lifecycle', 'city', 'venue', 'banner',
  'tier', 'tier.code', 'tier.name', 'tier.nameEn', 'tier.colorHex',
  'eventType', 'eventType.code', 'eventType.name', 'eventType.nameEn', 'eventType.colorHex',
  'subEvents', 'subEvents[].code', 'subEvents[].name', 'subEvents[].nameEn', 'hasPublicMatches',
];
const DETAIL_KEYS = [
  ...CARD_KEYS,
  'summary', 'summaryEn', 'presentedBy', 'ticketUrl', 'champions',
  'subEvents[].format',
  'subEvents[].competitorKind', 'subEvents[].drawKinds', 'subEvents[].hasGroups', 'subEvents[].entryCount',
  'days', 'tabs', 'tabs.matches', 'tabs.draws', 'tabs.groups', 'tabs.players', 'tabs.info',
  'stats', 'stats.players', 'stats.playedMatches',
];

describe('public events API (real Postgres)', () => {
  let kit: AuthTestKit;
  let cookie: string;
  let world: PublicWorld;
  let slug: string;
  let secret: string;
  let eventTypeId: string;
  let extraEventId: string | undefined;

  const event = (path = '') => publicGet(kit, secret, `events${path}`);
  const setEvent = (data: { publishStatus?: 'DRAFT' | 'PUBLISHED'; isCancelled?: boolean; startDate?: Date; endDate?: Date; showInfoTab?: boolean; infoBody?: string | null }) =>
    kit.prisma.event.update({ where: { id: world.fx.eventId }, data });
  const restore = () => setEvent({ publishStatus: 'PUBLISHED', isCancelled: false, startDate: new Date('2099-05-01'), endDate: new Date('2099-05-02'), showInfoTab: true, infoBody: null });

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    secret = process.env.SSR_INTERNAL_SECRET!;
    cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    world = await setupPublicWorld(kit, cookie);
    slug = world.slug;
    eventTypeId = (await kit.prisma.eventType.findFirstOrThrow({ where: { isActive: true } })).id;
  }, 180_000);

  afterAll(async () => {
    if (!kit) return;
    if (extraEventId) {
      await kit.prisma.auditLog.deleteMany({ where: { entityId: extraEventId } });
      await kit.prisma.event.deleteMany({ where: { id: extraEventId } });
    }
    await cleanupPublicWorld(kit, world);
    await kit.close();
  }, 60_000);

  it('finds the published event by search and returns the whitelisted card', async () => {
    const { data } = (await event(`?q=${world.tag}`).expect(200)).body;
    expect(data.items.map((i: { slug: string }) => i.slug)).toEqual([slug]);
    expect(data.items[0].lifecycle).toBe('UPCOMING');
    expect(data.items[0].hasPublicMatches).toBe(true);
    expect(sortedPaths(data.items)).toEqual(CARD_KEYS.map((k) => `[].${k}`).sort());
  });

  it('filters by year and status; unknown tier returns nothing', async () => {
    const q = `q=${world.tag}`;
    expect((await event(`?${q}&status=upcoming`).expect(200)).body.data.total).toBe(1);
    expect((await event(`?${q}&status=ongoing`).expect(200)).body.data.total).toBe(0);
    expect((await event(`?${q}&year=2099`).expect(200)).body.data.total).toBe(1);
    expect((await event(`?${q}&year=2098`).expect(200)).body.data.total).toBe(0);
    expect((await event(`?${q}&tier=no-such-tier`).expect(200)).body.data.total).toBe(0);
  });

  it('sorts upcoming events soonest first (ASC), other views newest first', async () => {
    const created = await kit.write('post', `${API}/events`, cookie, { name: `Order ${world.tag}`, eventTypeId, startDate: '2099-03-01', endDate: '2099-03-02' });
    expect(created.status).toBe(201);
    extraEventId = created.body.data.id as string;
    await kit.prisma.event.update({ where: { id: extraEventId }, data: { publishStatus: 'PUBLISHED' } });
    const upcoming = (await event(`?q=${world.tag}&status=upcoming`).expect(200)).body.data.items.map((i: { startDate: string }) => i.startDate);
    expect(upcoming).toEqual(['2099-03-01', '2099-05-01']);
    const other = (await event(`?q=${world.tag}`).expect(200)).body.data.items.map((i: { startDate: string }) => i.startDate);
    expect(other).toEqual(['2099-05-01', '2099-03-01']);
    const flags = (await event(`?q=${world.tag}`).expect(200)).body.data.items.map((i: { hasPublicMatches: boolean }) => i.hasPublicMatches);
    expect(flags).toEqual([true, false]);
  });

  it('lists the event in its calendar year under its month', async () => {
    const { data } = (await event('/calendar?year=2099').expect(200)).body;
    expect(data.months.flatMap((m: { events: { slug: string }[] }) => m.events).some((e: { slug: string }) => e.slug === slug)).toBe(true);
  });

  it('serves the detail with the whitelisted fields, tabs and stats', async () => {
    const { data } = (await event(`/${slug}`).expect(200)).body;
    expect(sortedPaths(data)).toEqual([...DETAIL_KEYS].sort());
    expect(data.tabs).toMatchObject({ matches: true, draws: true, groups: true, players: true, info: false });
    const ms = data.subEvents.find((s: { code: string }) => s.code === 'MS');
    expect(ms).toMatchObject({ drawKinds: ['MAIN'], hasGroups: false, entryCount: 5 });
    expect(data.subEvents.find((s: { code: string }) => s.code === 'WD')).toMatchObject({ drawKinds: [] });
    expect(data.subEvents.find((s: { code: string }) => s.code === 'MD')).toMatchObject({ drawKinds: [], hasGroups: true });
  });

  it('counts distinct players over confirmed entries: shared player once, withdrawn-only player not', async () => {
    const { data } = (await event(`/${slug}`).expect(200)).body;
    // MS 0-4 (5, player 5 withdrawn) + WS 6-9 (4) + MD 10-12 (3) + WD 13-16 (4, player 0 again not counted twice)
    expect(data.stats.players).toBe(16);
    // WS played match (1) + group matches OFFICIAL and not voided (2); the voided group match is excluded.
    expect(data.stats.playedMatches).toBe(3);
  });

  it('shows the info tab only when the sanitized info body is non-empty', async () => {
    expect((await event(`/${slug}/info`).expect(200)).body).toEqual({ data: null });
    await setEvent({ infoBody: '<p>Hi <strong>all</strong></p><script>alert(1)</script>' });
    const info = (await event(`/${slug}/info`).expect(200)).body.data;
    expect(info.infoBody).toContain('<strong>all</strong>');
    expect(info.infoBody).not.toContain('script');
    expect((await event(`/${slug}`).expect(200)).body.data.tabs.info).toBe(true);
    await setEvent({ infoBody: '<script>alert(1)</script>' });
    expect((await event(`/${slug}/info`).expect(200)).body).toEqual({ data: null });
    expect((await event(`/${slug}`).expect(200)).body.data.tabs.info).toBe(false);
    await restore();
  });

  it('hides a draft or cancelled event from every endpoint', async () => {
    const paths = [`/${slug}`, `/${slug}/info`, `/${slug}/matches`, `/${slug}/groups/MD`, `/${slug}/entries/MS`];
    const listedSlugs = async () => (await event(`?q=${world.tag}`).expect(200)).body.data.items.map((i: { slug: string }) => i.slug);
    const calendarSlugs = async () =>
      (await event('/calendar?year=2099').expect(200)).body.data.months.flatMap((m: { events: { slug: string }[] }) => m.events.map((e) => e.slug));

    await setEvent({ publishStatus: 'DRAFT' });
    for (const path of paths) expect((await event(path).expect(200)).body).toEqual({ data: null });
    expect(await listedSlugs()).not.toContain(slug);
    expect(await calendarSlugs()).not.toContain(slug);

    await setEvent({ publishStatus: 'PUBLISHED', isCancelled: true });
    for (const path of paths) expect((await event(path).expect(200)).body).toEqual({ data: null });
    expect(await listedSlugs()).not.toContain(slug);
    await restore();
    expect((await event(`/${slug}`).expect(200)).body.data).not.toBeNull();
  });

  it('answers null for an unknown slug and never leaks private profile data', async () => {
    expect((await event(`/no-such-${world.tag}`).expect(200)).body).toEqual({ data: null });
    const { legalName, legalNameEn, phone, email } = privateProfile(world.tag);
    const text = JSON.stringify([
      (await event(`?q=${world.tag}`).expect(200)).body,
      (await event(`/${slug}`).expect(200)).body,
      (await event('/calendar?year=2099').expect(200)).body,
    ]);
    for (const hidden of [legalName, legalNameEn, phone, email]) expect(text).not.toContain(hidden);
  });
});

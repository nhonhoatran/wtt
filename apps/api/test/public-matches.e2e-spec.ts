import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { cleanupPublicWorld, MATCH_CARD_KEYS, MATCH_DETAIL_KEYS, MATCH_SOURCE_KEYS, privateProfile, publicGet, type PublicWorld, setupPublicWorld, sortedPaths } from './support/public-api-kit.js';

describe('public matches API (real Postgres)', () => {
  let kit: AuthTestKit;
  let cookie: string;
  let world: PublicWorld;
  let slug: string;
  let secret: string;

  const get = (path: string) => publicGet(kit, secret, `events/${slug}/${path}`);
  const count = (where: object) => kit.prisma.match.count({ where: { eventId: world.fx.eventId, ...where } });
  const realMatch = { OR: [{ resultType: null }, { resultType: { not: 'BYE' } }], draw: { status: 'PUBLISHED' as const } };

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    secret = process.env.SSR_INTERNAL_SECRET!;
    cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    world = await setupPublicWorld(kit, cookie);
    slug = world.slug;
  }, 180_000);

  afterAll(async () => {
    if (!kit) return;
    await cleanupPublicWorld(kit, world);
    await kit.close();
  }, 60_000);

  it('lists only real matches of published draws; BYEs never appear in any state', async () => {
    const states = ['live', 'completed', 'upcoming'] as const;
    const totals = await Promise.all(states.map(async (state) => (await get(`matches?state=${state}`).expect(200)).body.data.total));
    const expectedReal = await count(realMatch);
    expect(await count({ resultType: 'BYE' })).toBeGreaterThan(0);
    expect(totals.reduce((a, b) => a + b, 0)).toBe(expectedReal);
    expect(totals[1]).toBe(await count({ status: 'OFFICIAL', ...realMatch }));
    expect(totals[2]).toBe(await count({ status: 'SCHEDULED', ...realMatch }));
  });

  it('keeps BYE matches out of the list and answers their detail with null', async () => {
    const bye = await kit.prisma.match.findFirstOrThrow({ where: { eventId: world.fx.eventId, resultType: 'BYE' } });
    const { body } = await get(`matches/${bye.matchNo}`).expect(200);
    expect(body).toEqual({ data: null });
    const list = (await get('matches?state=upcoming&page=1').expect(200)).body.data.items;
    expect(list.some((m: { matchNo: number }) => m.matchNo === bye.matchNo)).toBe(false);
  });

  it('filters by sub-event code and hides a draft draw (WD) completely', async () => {
    // MS only has confirmed BYEs; the one played match is in WS.
    const ws = (await get('matches?state=completed&sub=WS').expect(200)).body.data;
    expect(ws.items.length).toBeGreaterThan(0);
    expect(ws.items.every((m: { subEvent: { code: string } }) => m.subEvent.code === 'WS')).toBe(true);
    expect((await get('matches?state=completed&sub=MS').expect(200)).body.data.total).toBe(0);
    expect((await get('matches?state=upcoming&sub=WD').expect(200)).body.data.total).toBe(0);
  });

  it('finds a player by display name and not by the hidden legal name', async () => {
    const { displayName, legalName } = privateProfile(world.tag);
    const byDisplay = (await get(`matches?state=upcoming&q=${encodeURIComponent(displayName)}`).expect(200)).body.data;
    expect(byDisplay.total).toBeGreaterThan(0);
    expect(JSON.stringify(byDisplay.items)).toContain(displayName);

    const byLegal = (await get(`matches?state=upcoming&q=${encodeURIComponent(legalName)}`).expect(200)).body.data;
    expect(byLegal.total).toBe(0);
  });

  it('serves a played match detail with the event header and timestamps', async () => {
    const played = await kit.prisma.match.findFirstOrThrow({ where: { eventId: world.fx.eventId, status: 'OFFICIAL', resultType: 'NORMAL', drawId: world.wsDrawId } });
    const { data } = (await get(`matches/${played.matchNo}`).expect(200)).body;
    expect(data).toMatchObject({ matchNo: played.matchNo, status: 'OFFICIAL', winnerSide: 1, games1: 3, games2: 0, voided: false, drawKind: 'MAIN' });
    expect(data.event).toMatchObject({ slug, timezone: expect.any(String) });
    expect(data.games).toHaveLength(3);
    expect(sortedPaths(data)).toEqual([...MATCH_CARD_KEYS, ...MATCH_DETAIL_KEYS].sort());
  });

  it('snapshots the match card fields across list states (union of cards)', async () => {
    const upcoming = (await get('matches?state=upcoming').expect(200)).body.data.items;
    const completed = (await get('matches?state=completed').expect(200)).body.data.items;
    const paths = sortedPaths([...upcoming, ...completed]);
    expect(paths).toEqual([...MATCH_CARD_KEYS, ...MATCH_SOURCE_KEYS].map((k) => `[].${k}`).sort());
  });

  it('returns a voided flag on each card (false for ordinary matches)', async () => {
    const completed = (await get('matches?state=completed').expect(200)).body.data.items;
    expect(completed.every((m: { voided: unknown }) => typeof m.voided === 'boolean')).toBe(true);
    expect(completed.some((m: { voided: boolean }) => m.voided === false)).toBe(true);
  });

  it('answers unknown slugs and malformed match numbers with null', async () => {
    expect((await publicGet(kit, secret, `events/no-such-${world.tag}/matches`).expect(200)).body).toEqual({ data: null });
    expect((await get('matches/abc').expect(200)).body).toEqual({ data: null });
    expect((await get('matches/999999999').expect(200)).body).toEqual({ data: null });
  });

  it('never leaks contact data or the hidden legal name in any match response', async () => {
    const { legalName, legalNameEn, phone, email } = privateProfile(world.tag);
    const texts = await Promise.all([
      get('matches?state=completed&page=1'),
      get('matches?state=upcoming'),
      get('matches?state=live'),
    ].map(async (req) => JSON.stringify((await req.expect(200)).body)));
    for (const text of texts) {
      for (const secretValue of [legalName, legalNameEn, phone, email]) expect(text).not.toContain(secretValue);
    }
  });
});

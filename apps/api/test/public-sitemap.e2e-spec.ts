import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PublicSitemap } from '@kamito/shared';
import { AuthTestKit } from './support/auth-test-kit.js';
import { cleanupPublicWorld, publicGet, setupPublicWorld, sortedPaths, type PublicWorld } from './support/public-api-kit.js';

describe('public sitemap discovery (real Postgres)', () => {
  let kit: AuthTestKit;
  let world: PublicWorld | undefined;
  const videoIds: string[] = [];

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    const cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    world = await setupPublicWorld(kit, cookie);
  }, 180_000);

  afterAll(async () => {
    if (!kit) return;
    try {
      await kit.prisma.video.deleteMany({ where: { id: { in: videoIds } } });
      await cleanupPublicWorld(kit, world);
    } finally { await kit.close(); }
  }, 60_000);

  async function sitemap(): Promise<PublicSitemap> {
    return (await publicGet(kit, world!.secret, 'sitemap').expect(200)).body.data as PublicSitemap;
  }

  it('lists only published videos whose publication time has arrived', async () => {
    const cases = [
      { suffix: 'published', status: 'PUBLISHED' as const, publishedAt: new Date('2020-01-01T00:00:00Z') },
      { suffix: 'draft', status: 'DRAFT' as const, publishedAt: null },
      { suffix: 'archived', status: 'ARCHIVED' as const, publishedAt: new Date('2020-01-01T00:00:00Z') },
      { suffix: 'future', status: 'PUBLISHED' as const, publishedAt: new Date('2999-01-01T00:00:00Z') },
      { suffix: 'undated', status: 'PUBLISHED' as const, publishedAt: null },
    ];
    for (const fixture of cases) {
      const row = await kit.prisma.video.create({ data: {
        slug: `sitemap-${world!.tag}-${fixture.suffix}`, title: 'Sitemap video', provider: 'youtube', embedId: 'Abcdef_1234',
        url: 'https://www.youtube.com/watch?v=Abcdef_1234', status: fixture.status, publishedAt: fixture.publishedAt,
      } });
      videoIds.push(row.id);
    }

    const data = await sitemap();
    const videos = data.videos.filter((row) => row.slug.startsWith(`sitemap-${world!.tag}-`));
    expect(videos).toHaveLength(1);
    expect(videos[0]!.slug).toBe(`sitemap-${world!.tag}-published`);
    expect(sortedPaths(videos)).toEqual(['[].slug', '[].updatedAt']);
    expect(new Date(videos[0]!.updatedAt).toISOString()).toBe(videos[0]!.updatedAt);
  });

  it('limits match URLs to official, non-voided, non-BYE matches of public events and draws', async () => {
    const where = { eventId: world!.fx.eventId };
    const draftMatch = await kit.prisma.match.findFirstOrThrow({ where: { ...where, draw: { status: 'DRAFT' }, resultType: null } });
    await kit.prisma.match.update({ where: { id: draftMatch.id }, data: { status: 'OFFICIAL', resultType: 'NORMAL', winnerSide: 1 } });
    const rows = await kit.prisma.match.findMany({ where, include: { draw: { select: { status: true } } } });
    const expected = rows.filter((row) => row.status === 'OFFICIAL' && !row.isVoided && row.resultType !== 'BYE' && row.draw.status === 'PUBLISHED');
    expect(expected.length).toBeGreaterThan(0);

    const matches = (await sitemap()).matches.filter((row) => row.eventSlug === world!.slug);
    expect(matches.map((row) => row.matchNo).sort((a, b) => a - b)).toEqual(expected.map((row) => row.matchNo).sort((a, b) => a - b));
    expect(sortedPaths(matches)).toEqual(['[].eventSlug', '[].matchNo', '[].updatedAt']);
    for (const row of matches) expect(new Date(row.updatedAt).toISOString()).toBe(row.updatedAt);

    for (const data of [{ publishStatus: 'DRAFT' as const }, { publishStatus: 'PUBLISHED' as const, isCancelled: true }]) {
      await kit.prisma.event.update({ where: { id: world!.fx.eventId }, data });
      expect((await sitemap()).matches.some((row) => row.eventSlug === world!.slug)).toBe(false);
    }
    await kit.prisma.event.update({ where: { id: world!.fx.eventId }, data: { publishStatus: 'PUBLISHED', isCancelled: false } });
  });

  it('exposes only public route capabilities and keeps player profile identifiers out', async () => {
    const data = await sitemap();
    const event = data.events.find((row) => row.slug === world!.slug);
    expect(event?.tabs).toMatchObject({ matches: true, info: false });
    expect(event?.subEvents.find((row) => row.code === 'MS')).toMatchObject({ drawKinds: ['MAIN'], hasGroups: false, entryCount: 5 });
    expect(event?.subEvents.find((row) => row.code === 'MD')).toMatchObject({ drawKinds: [], hasGroups: true });
    expect(event?.subEvents.find((row) => row.code === 'WD')).toMatchObject({ drawKinds: [] });
    expect(data).not.toHaveProperty('players');
    expect(JSON.stringify(data)).not.toContain(world!.playerIds[0]);
  });
});

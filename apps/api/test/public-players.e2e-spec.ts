import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma, type AppSetting } from '@kamito/db';
import { ageOnEvent, playerSettings, publicPlayerSlug, todayInTimezone, tournamentSettings, type PublicPlayerList, type PublicPlayerProfile, type PublicPlayerResults } from '@kamito/shared';
import { PublicPlayerProfileQuery } from '../src/modules/public-players/public-player-profile.query.js';
import { publicPlayerRanks } from '../src/modules/public-players/public-player-ranks.query.js';
import { AuthTestKit } from './support/auth-test-kit.js';
import { cleanupPublicWorld, privateProfile, PUBLIC, publicGet, setupPublicWorld, sortedPaths, type PublicWorld } from './support/public-api-kit.js';
import { deleteSnapshotsOfLists } from './support/ranking-test-kit.js';

describe('public players and profiles (real Postgres)', () => {
  let kit: AuthTestKit;
  let world: PublicWorld;
  let secret: string;
  let slugs: Map<string, string>;
  let savedSettings: AppSetting[];
  let doubleListId: string;
  let profileId: string;
  let profileSlug: string;
  let cookie: string;
  const extraPlayerIds: string[] = [];
  const listIds: string[] = [];
  const settingKeys = [playerSettings.showAge.key, tournamentSettings.publicListPageSize.key];
  const get = (path: string) => publicGet(kit, secret, path);
  const profile = async (slug = profileSlug) => (await get(`players/${slug}`).expect(200)).body.data as PublicPlayerProfile | { redirectTo: string } | null;
  const players = async (query = '') => (await get(`players${query}`).expect(200)).body.data as PublicPlayerList;
  const results = async (slug = profileSlug, query = '') => (await get(`players/${slug}/results${query}`).expect(200)).body.data as PublicPlayerResults | null;

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    secret = process.env.SSR_INTERNAL_SECRET!;
    savedSettings = await kit.prisma.appSetting.findMany({ where: { key: { in: settingKeys } } });
    for (const [key, value] of [[playerSettings.showAge.key, false], [tournamentSettings.publicListPageSize.key, 6]] as const) await kit.prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
    cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    world = await setupPublicWorld(kit, cookie);
    profileId = world.playerIds[6]!;
    const p = await kit.prisma.player.update({ where: { id: profileId }, data: { publicDisplayName: `Nguyễn Văn Ánh ${world.tag}`, club: `Club ${world.tag}`, handedness: 'LEFT', bio: 'Tiểu sử thuần văn bản', bioEn: 'Plain-text biography' } });
    profileSlug = publicPlayerSlug(p.id);
    slugs = new Map((await kit.prisma.player.findMany({ where: { id: { in: world.playerIds } }, select: { id: true, slug: true } })).map((p) => [p.id, p.slug]));
    await kit.prisma.player.update({ where: { id: world.playerIds[1]! }, data: { isPublicProfile: false } });
    await kit.prisma.player.update({ where: { id: world.playerIds[2]! }, data: { isActive: false } });
    const ms = await kit.prisma.rankingList.create({ data: { code: `P-MS-${world.tag}`, name: `Singles ${world.tag}`, competitorKind: 'SINGLES', genderRule: 'MEN', validityDays: 365 } });
    const md = await kit.prisma.rankingList.create({ data: { code: `P-MD-${world.tag}`, name: `Doubles ${world.tag}`, competitorKind: 'DOUBLES', genderRule: 'MEN', validityDays: 365 } });
    doubleListId = md.id;
    listIds.push(ms.id, md.id);
    for (const [id, kind] of [[ms.id, 'SINGLES'], [md.id, 'DOUBLES']] as const) {
      for (const [asOfDate, status, points] of [['2099-05-01', 'PUBLISHED', 50], ['2099-06-01', 'PUBLISHED', 1000], ['2100-01-01', 'DRAFT', 9999]] as const) {
        const s = await kit.prisma.rankingSnapshot.create({ data: { rankingListId: id, asOfDate: new Date(asOfDate) } });
        await kit.prisma.rankingSnapshotRow.create({ data: { snapshotId: s.id, playerId: profileId, rank: kind === 'SINGLES' ? 4 : 2, previousRank: 5, movement: kind === 'SINGLES' ? 1 : 3, points, resultsCounted: 1, breakdown: [] } });
        if (status === 'PUBLISHED') await kit.prisma.rankingSnapshot.update({ where: { id: s.id }, data: { status, publishedAt: new Date('2099-06-02') } });
      }
    }
    for (let i = 0; i < 3; i++) {
      const old = await kit.prisma.player.create({ data: { code: `OLD-${world.tag}-${i}`, slug: `old-${world.tag}-${i}`, fullName: `Old ${world.tag} ${i}`, normalizedName: `old ${world.tag} ${i}`, gender: 'MALE', countryCode: 'VIE', isActive: false } });
      extraPlayerIds.push(old.id);
    }
    await kit.prisma.player.update({ where: { id: extraPlayerIds[0]! }, data: { mergedIntoId: extraPlayerIds[1]!, mergedAt: new Date() } });
    await kit.prisma.player.update({ where: { id: extraPlayerIds[1]! }, data: { mergedIntoId: profileId, mergedAt: new Date() } });
  }, 180_000);

  afterAll(async () => {
    if (!kit) return;
    try {
      if (savedSettings) {
        await kit.prisma.appSetting.deleteMany({ where: { key: { in: settingKeys } } });
        for (const row of savedSettings) await kit.prisma.appSetting.create({ data: { ...row, value: row.value === null ? Prisma.JsonNull : row.value } });
      }
      if (listIds.length) {
        await deleteSnapshotsOfLists(kit, listIds);
        await kit.prisma.rankingList.deleteMany({ where: { id: { in: listIds } } });
      }
      await kit.prisma.player.updateMany({ where: { id: { in: extraPlayerIds } }, data: { mergedIntoId: null } });
      await kit.prisma.player.deleteMany({ where: { id: { in: extraPlayerIds } } });
      await cleanupPublicWorld(kit, world);
    } finally { await kit.close(); }
  }, 60_000);

  it('serves only active, public, non-merged players and searches the public alias without accents', async () => {
    const accented = await players(`?q=${encodeURIComponent(`Nguyễn Văn Ánh ${world.tag}`)}`);
    const plain = await players(`?q=nguyen%20van%20anh%20${world.tag}`);
    expect(plain).toEqual(accented);
    expect(plain.items.map((p) => p.slug)).toEqual([profileSlug]);
    expect((await players(`?q=${encodeURIComponent(privateProfile(world.tag).legalName)}`)).total).toBe(0);
    const listed = await players(`?q=${world.tag}`);
    expect(listed.items.map((p) => p.slug)).not.toContain(publicPlayerSlug(world.playerIds[1]!));
    expect(listed.items.map((p) => p.slug)).not.toContain(publicPlayerSlug(world.playerIds[2]!));
    expect(JSON.stringify(listed)).not.toContain(`old-${world.tag}`);
    expect((await players(`?q=${world.tag}&gender=female`)).total).toBe(0);
    expect((await players(`?club=${encodeURIComponent(`Club ${world.tag}`)}`)).items.map((p) => p.slug)).toEqual([profileSlug]);
  });

  it('sorts current published ranks before pagination, preserves public-name order and stable ties', async () => {
    const ranked = await players(`?q=${world.tag}&sort=rank`);
    expect(ranked.items[0]!.slug).toBe(profileSlug);
    const expected = await kit.prisma.player.findMany({ where: { id: { in: world.playerIds }, isActive: true, isPublicProfile: true, mergedIntoId: null }, select: { id: true, slug: true, normalizedPublicName: true } });
    const sorted = expected.sort((a, b) => a.normalizedPublicName < b.normalizedPublicName ? -1 : a.normalizedPublicName > b.normalizedPublicName ? 1 : a.id < b.id ? -1 : 1);
    const collected: string[] = [];
    for (let page = 1; page <= Math.ceil(sorted.length / 6); page++) collected.push(...(await players(`?q=${world.tag}&sort=name&page=${page}`)).items.map((p) => p.slug));
    expect(collected).toEqual(sorted.map((p) => publicPlayerSlug(p.id)));
    expect((await players(`?q=${world.tag}&page=999`)).items).toEqual([]);
  });

  it('uses current snapshots in every active list and never a newer draft or an old rank', async () => {
    const data = await profile() as PublicPlayerProfile;
    expect(data.ranks.filter((r) => r.list.code.endsWith(world.tag))).toEqual(expect.arrayContaining([
      expect.objectContaining({ rank: 4, points: 1000, asOfDate: '2099-06-01', list: expect.objectContaining({ competitorKind: 'SINGLES' }) }),
      expect.objectContaining({ rank: 2, points: 1000, asOfDate: '2099-06-01', list: expect.objectContaining({ competitorKind: 'DOUBLES' }) }),
    ]));
    await kit.prisma.rankingList.update({ where: { id: doubleListId }, data: { isActive: false } });
    try { expect((await profile() as PublicPlayerProfile).ranks.some((r) => r.list.code === `P-MD-${world.tag}`)).toBe(false); }
    finally { await kit.prisma.rankingList.update({ where: { id: doubleListId }, data: { isActive: true } }); }
  });

  it('whitelists the entire profile and keeps contacts, dates and legal aliases private', async () => {
    const data = await profile() as PublicPlayerProfile;
    expect(data).toMatchObject({ slug: profileSlug, name: `Nguyễn Văn Ánh ${world.tag}`, nameEn: null, noindex: true, handedness: 'LEFT', age: null, bio: 'Tiểu sử thuần văn bản' });
    expect(sortedPaths(data)).toEqual([
      'slug', 'name', 'nameEn', 'club', 'photo', 'gender', 'ranks', 'noindex', 'countryCode', 'handedness', 'age', 'bio', 'bioEn',
      ...['rank', 'points', 'movement', 'asOfDate', 'list', 'list.code', 'list.name', 'list.nameEn', 'list.competitorKind', 'list.genderRule', 'list.category'].map((key) => `ranks[].${key}`),
      'events', ...['slug', 'name', 'nameEn', 'startDate', 'endDate'].map((key) => `events[].${key}`),
    ].sort());
    const raw = JSON.stringify(data);
    for (const hidden of ['phone', 'email', 'birthDate', 'birthYear', 'normalizedName', privateProfile(world.tag).phone, privateProfile(world.tag).email, privateProfile(world.tag).legalName]) expect(raw).not.toContain(hidden);
  });

  it('shows age only when configured, with birthDate winning over birthYear and a year-only fallback', async () => {
    const timezoneRow = await kit.prisma.appSetting.findUnique({ where: { key: tournamentSettings.defaultTimezone.key } });
    const timezone = tournamentSettings.defaultTimezone.schema.safeParse(timezoneRow?.value);
    const today = todayInTimezone(timezone.success ? timezone.data : tournamentSettings.defaultTimezone.defaultValue);
    await kit.prisma.appSetting.update({ where: { key: playerSettings.showAge.key }, data: { value: true } });
    try {
      expect((await profile() as PublicPlayerProfile).age).toBe(ageOnEvent({ birthDate: privateProfile(world.tag).birthDate }, today, 'EVENT_START_DATE'));
      await kit.prisma.player.update({ where: { id: profileId }, data: { birthDate: null, birthYear: 2000 } });
      expect((await profile() as PublicPlayerProfile).age).toBe(Number(today.slice(0, 4)) - 2000);
    } finally {
      await kit.prisma.player.update({ where: { id: profileId }, data: { birthDate: privateProfile(world.tag).birthDate, birthYear: null } });
      await kit.prisma.appSetting.update({ where: { key: playerSettings.showAge.key }, data: { value: false } });
    }
  });

  it('returns null for private or inactive profiles and results; follows merged chains only to a public target', async () => {
    expect(await profile(slugs.get(world.playerIds[1]!)!)).toBeNull();
    expect(await results(slugs.get(world.playerIds[1]!)!)).toBeNull();
    expect(await profile(slugs.get(world.playerIds[2]!)!)).toBeNull();
    expect(await profile(publicPlayerSlug(world.playerIds[1]!))).toBeNull();
    expect(await results(publicPlayerSlug(world.playerIds[1]!))).toBeNull();
    expect(await profile(`old-${world.tag}-0`)).toEqual({ redirectTo: profileSlug });
    expect(await profile(`old-${world.tag}-1`)).toEqual({ redirectTo: profileSlug });
    expect(await profile(publicPlayerSlug(extraPlayerIds[0]!))).toEqual({ redirectTo: profileSlug });
    const legacy = await kit.prisma.player.findUniqueOrThrow({ where: { id: profileId }, select: { slug: true } });
    expect(await profile(legacy.slug)).toEqual({ redirectTo: profileSlug });
    await kit.prisma.player.update({ where: { id: profileId }, data: { isPublicProfile: false } });
    try { expect(await profile(`old-${world.tag}-0`)).toBeNull(); }
    finally { await kit.prisma.player.update({ where: { id: profileId }, data: { isPublicProfile: true } }); }
    expect(await profile(`old-${world.tag}-2`)).toBeNull();
    expect(await profile(`missing-${world.tag}`)).toBeNull();
  });

  it('keeps API-created legal-name slugs out of every public player surface after an alias changes', async () => {
    // setupPublicWorld creates every player through the real admin API and identity allocator.
    const playerId = world.playerIds[0]!;
    const original = await kit.prisma.player.findUniqueOrThrow({ where: { id: playerId } });
    const alias = `Bí danh an toàn ${world.tag}`;
    const safeSlug = publicPlayerSlug(playerId);
    const list = await kit.prisma.rankingList.create({ data: {
      code: `SAFE-${world.tag}`, name: `Safe list ${world.tag}`, competitorKind: 'SINGLES', genderRule: 'MEN', validityDays: 365,
    } });
    listIds.push(list.id);
    const snapshot = await kit.prisma.rankingSnapshot.create({ data: {
      rankingListId: list.id, asOfDate: new Date('2099-06-01'),
      rows: { create: { playerId, rank: 1, points: 100, resultsCounted: 1, breakdown: [] } },
    } });
    await kit.prisma.rankingSnapshot.update({ where: { id: snapshot.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    try {
      await kit.write('patch', `/api/v1/admin/players/${playerId}`, cookie, { publicDisplayName: alias }).expect(200);
      expect(await profile(original.slug)).toEqual({ redirectTo: safeSlug });
      const path = `events/${world.slug}`;
      const surfaces = [
        await players(`?q=${encodeURIComponent(alias)}`),
        await profile(safeSlug),
        (await get(`rankings/${list.code}`).expect(200)).body.data,
        (await get(`${path}/entries/MS`).expect(200)).body.data,
        (await get(`${path}/draws/MS`).expect(200)).body.data,
        (await get(`${path}/matches?state=upcoming&q=${encodeURIComponent(alias)}`).expect(200)).body.data,
      ];
      for (const value of surfaces) {
        const raw = JSON.stringify(value);
        expect(raw).toContain(alias);
        expect(raw).toContain(safeSlug);
        expect(raw).not.toContain(original.slug);
        expect(raw).not.toContain(original.fullName);
        if (original.fullNameEn) expect(raw).not.toContain(original.fullNameEn);
      }
      await kit.write('patch', `/api/v1/admin/players/${playerId}`, cookie, { publicDisplayName: `${alias} mới` }).expect(200);
      expect((await profile(safeSlug) as PublicPlayerProfile).slug).toBe(safeSlug);
      expect((await profile(safeSlug) as PublicPlayerProfile).name).toBe(`${alias} mới`);
    } finally {
      await kit.prisma.player.update({ where: { id: playerId }, data: { publicDisplayName: original.publicDisplayName } });
    }
  });

  it('includes only entered public events, and an empty profile works with no matches', async () => {
    const data = await profile() as PublicPlayerProfile;
    expect(data.events.map((event) => event.slug)).toContain(world.slug);
    expect((await results())!.items).toEqual([]);
    await kit.prisma.event.update({ where: { id: world.fx.eventId }, data: { publishStatus: 'DRAFT' } });
    try { expect((await profile() as PublicPlayerProfile).events.map((event) => event.slug)).not.toContain(world.slug); }
    finally { await kit.prisma.event.update({ where: { id: world.fx.eventId }, data: { publishStatus: 'PUBLISHED' } }); }
  });

  it('filters every club length accepted by the admin including 101 and 200 characters', async () => {
    const original = await kit.prisma.player.findUniqueOrThrow({ where: { id: profileId }, select: { club: true } });
    try {
      for (const length of [100, 101, 200]) {
        const club = `Club ${world.tag} `.padEnd(length, 'x');
        await kit.write('patch', `/api/v1/admin/players/${profileId}`, cookie, { club }).expect(200);
        const filtered = await players(`?club=${encodeURIComponent(club)}`);
        expect(filtered.items.map((player) => player.slug)).toEqual([profileSlug]);
        expect(filtered.clubs).toContain(club);
      }
      await kit.write('patch', `/api/v1/admin/players/${profileId}`, cookie, { club: 'x'.repeat(201) }).expect(422);
    } finally { await kit.prisma.player.update({ where: { id: profileId }, data: { club: original.club } }); }
  });

  it('lists only official real non-voided matches of public draws for either side', async () => {
    const match = await kit.prisma.match.findFirstOrThrow({ where: { drawId: world.wsDrawId, status: 'OFFICIAL', resultType: 'NORMAL' }, include: { side1Entry: { include: { competitor: true } }, side2Entry: { include: { competitor: true } } } });
    const playerA = slugs.get(match.side1Entry!.competitor.playerId!)!;
    const playerB = slugs.get(match.side2Entry!.competitor.playerId!)!;
    expect((await results(playerA))!.items.map((item) => item.matchNo)).toContain(match.matchNo);
    expect((await results(playerB))!.items.map((item) => item.matchNo)).toContain(match.matchNo);
    try {
      await kit.prisma.match.update({ where: { id: match.id }, data: { isVoided: true } });
      expect((await results(playerA))!.items.some((item) => item.matchNo === match.matchNo)).toBe(false);
      await kit.prisma.match.update({ where: { id: match.id }, data: { isVoided: false } });
      await kit.prisma.draw.update({ where: { id: world.wsDrawId }, data: { status: 'DRAFT' } });
      expect((await results(playerA))!.items.some((item) => item.matchNo === match.matchNo)).toBe(false);
    } finally { await kit.prisma.draw.update({ where: { id: world.wsDrawId }, data: { status: 'PUBLISHED' } }); }
    for (const id of world.playerIds.slice(0, 6)) {
      const data = await results(slugs.get(id)!);
      expect(data?.items.every((item) => item.resultType !== null && item.status === 'OFFICIAL')).not.toBe(false);
    }
  });

  it('computes one page of ranks with one statement and a profile with three reads', async () => {
    const map = await publicPlayerRanks(kit.prisma, [profileId]);
    expect(map.get(profileId)).toHaveLength(2);
    // Count calls rather than mocking database results; all SQL still runs on the real database.
    const original = kit.prisma.$queryRaw.bind(kit.prisma);
    let reads = 0;
    kit.prisma.$queryRaw = ((...args: Parameters<typeof original>) => { reads++; return original(...args); }) as typeof kit.prisma.$queryRaw;
    try {
      expect(await kit.app.get(PublicPlayerProfileQuery).profile(profileSlug)).not.toBeNull();
      expect(reads).toBe(3);
    } finally { kit.prisma.$queryRaw = original; }
  });

  it.each(['players', 'players/any', 'players/any/results'])('requires the SSR secret for %s', async (path) => {
    await kit.http.get(`${PUBLIC}/${path}`).expect(403);
  });
});

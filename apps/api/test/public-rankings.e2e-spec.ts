import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma, type AppSetting } from '@kamito/db';
import { publicPlayerSlug, rankingSettings, SSR_SECRET_HEADER, type PublicRankingList } from '@kamito/shared';
import { AuthTestKit } from './support/auth-test-kit.js';
import { PUBLIC, publicGet, sortedPaths } from './support/public-api-kit.js';
import { addRules, cleanupRankingWorld, createRankingWorld, type RankingWorld } from './support/ranking-test-kit.js';

const SETTINGS_KEY = rankingSettings.overviewTopN.key;
const PLAYER_KEYS = ['slug', 'name', 'nameEn', 'club', 'photo'];
const LIST_KEYS = ['code', 'name', 'nameEn', 'competitorKind', 'genderRule', 'category'];

describe('public rankings and event points (real Postgres)', () => {
  let kit: AuthTestKit;
  let secret: string;
  let world: RankingWorld;
  let slug: string;
  let code: string;
  let newest: string;
  let saved: AppSetting | null;
  const worlds: RankingWorld[] = [];
  const get = (path: string) => publicGet(kit, secret, path);
  const list = async (query = '') => (await get(`rankings/${code}${query}`).expect(200)).body.data as PublicRankingList;

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    secret = process.env.SSR_INTERNAL_SECRET!;
    saved = await kit.prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
    await kit.prisma.appSetting.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value: 3 }, update: { value: 3 } });
    world = await createRankingWorld(kit);
    worlds.push(world);
    const event = await kit.prisma.event.update({ where: { id: world.eventId }, data: { publishStatus: 'PUBLISHED' } });
    slug = event.slug;
    code = (await kit.prisma.rankingList.findUniqueOrThrow({ where: { id: world.listId } })).code;
    const players = Array.from({ length: 52 }, (_, n) => ({
      id: randomUUID(), code: `PUB-${world.tag}-${n}`, slug: `public-${world.tag}-${n}`,
      fullName: `Legal ${world.tag} ${n}`, fullNameEn: `Legal English ${world.tag} ${n}`,
      publicDisplayName: n === 0 ? `Nguyễn Văn Ánh ${world.tag}` : `Public ${world.tag} ${String(n).padStart(3, '0')}`,
      normalizedName: `legal ${world.tag} ${n}`, gender: 'MALE' as const, countryCode: 'VIE',
      club: n === 0 ? `Club A ${world.tag}` : `Club B ${world.tag}`,
      isPublicProfile: n !== 1,
      phone: '0987654321', email: `private-${n}@example.test`, birthDate: new Date('2000-01-01'),
    }));
    world.playerIds.push(...players.map((p) => p.id));
    await kit.prisma.player.createMany({ data: players });
    const breakdown = (points: number) => [{ ledgerId: 'internal-ledger-id', eventId: event.id, eventSlug: slug, eventName: `Frozen event ${world.tag}`, eventNameEn: null, eventTypeCode: `RE-${world.tag}`, stageCode: 'W', points, earnedAt: '2099-05-02', expiresAt: '2100-05-02', reason: 'private manual reason' }];
    for (const [asOfDate, status, points] of [['2099-05-01', 'PUBLISHED', 100], ['2099-06-01', 'PUBLISHED', 1000], ['2100-01-01', 'DRAFT', 9000]] as const) {
      const snapshot = await kit.prisma.rankingSnapshot.create({ data: { rankingListId: world.listId, asOfDate: new Date(asOfDate) } });
      await kit.prisma.rankingSnapshotRow.createMany({ data: players.map((p, n) => ({ snapshotId: snapshot.id, playerId: p.id, rank: n + 1, points: points - n, previousRank: n + 3, movement: 2, resultsCounted: 1, breakdown: breakdown(points - n) })) });
      if (status === 'PUBLISHED') {
        await kit.prisma.rankingSnapshot.update({ where: { id: snapshot.id }, data: { status, publishedAt: new Date('2099-06-02') } });
        newest = snapshot.id;
      }
    }
    await kit.prisma.rankingPointsEarned.create({ data: { rankingListId: world.listId, playerId: players[0]!.id, source: 'MANUAL', points: 1000, earnedAt: new Date('2099-05-02'), expiresAt: new Date('2100-05-02'), reason: 'internal reason' } });
    await addRules(kit, world, [{ stageCode: 'W', points: 100, effectiveFrom: '2098-01-01' }, { stageCode: 'F', points: 50, effectiveFrom: '2098-01-01' }, { stageCode: 'W', points: 250, effectiveFrom: '2099-05-02' }, { stageCode: 'W', points: 9999, effectiveFrom: '2099-05-03' }]);
  }, 120_000);

  afterAll(async () => {
    if (!kit) return;
    try {
      if (saved) await kit.prisma.appSetting.upsert({ where: { key: SETTINGS_KEY }, create: { ...saved, value: saved.value === null ? Prisma.JsonNull : saved.value }, update: { value: saved.value === null ? Prisma.JsonNull : saved.value, updatedById: saved.updatedById, updatedAt: saved.updatedAt } });
      else await kit.prisma.appSetting.deleteMany({ where: { key: SETTINGS_KEY } });
      await cleanupRankingWorld(kit, worlds);
    } finally { await kit.close(); }
  }, 60_000);

  it('reads the latest published snapshot, not a newer draft, and obeys the dynamic top-N setting', async () => {
    const overview = (await get('rankings').expect(200)).body.data;
    expect(overview.topN).toBe(3);
    const mine = overview.items.find((item: { list: { code: string } }) => item.list.code === code);
    expect(mine.asOfDate).toBe('2099-06-01');
    expect(mine.items.map((item: { rank: number; points: number }) => [item.rank, item.points])).toEqual([[1, 1000], [2, 999], [3, 998]]);
    expect(mine.items.every((item: { breakdown: unknown[] }) => item.breakdown.length === 0)).toBe(true);
    await kit.prisma.appSetting.update({ where: { key: SETTINGS_KEY }, data: { value: 2 } });
    expect((await get('rankings').expect(200)).body.data.items.find((item: { list: { code: string } }) => item.list.code === code).items).toHaveLength(2);
    await kit.prisma.appSetting.update({ where: { key: SETTINGS_KEY }, data: { value: 3 } });
  });

  it('keeps points and breakdown immutable after the live ledger changes', async () => {
    const before = await list('?pageSize=1');
    await kit.prisma.rankingPointsEarned.updateMany({ where: { rankingListId: world.listId }, data: { points: 7777 } });
    await kit.prisma.event.update({ where: { id: world.eventId }, data: { name: `Renamed live event ${world.tag}` } });
    expect(await list('?pageSize=1')).toEqual(before);
    expect(before.items[0]!.breakdown[0]).toMatchObject({ points: 1000, eventName: `Frozen event ${world.tag}` });
  });

  it('searches normalized public aliases and never discovers the hidden legal name', async () => {
    const accented = await list(`?q=${encodeURIComponent(`Nguyễn Văn Ánh ${world.tag}`)}`);
    const plain = await list(`?q=nguyen%20van%20anh%20${world.tag}`);
    expect(plain).toEqual(accented);
    expect(plain.total).toBe(1);
    expect((await list(`?q=Legal%20${world.tag}%200`)).total).toBe(0);
    expect(JSON.stringify(plain)).not.toContain('Legal English');
  });

  it('filters clubs and paginates before serializing, caps public page size and keeps stable order', async () => {
    const club = await list(`?club=${encodeURIComponent(`Club A ${world.tag}`)}`);
    expect(club.total).toBe(1);
    expect(club.items[0]!.rank).toBe(1);
    const page = await list('?page=2&pageSize=2');
    expect(page).toMatchObject({ page: 2, pageSize: 2, total: 52 });
    expect(page.items.map((row) => row.rank)).toEqual([3, 4]);
    expect(await list('?page=2&pageSize=2')).toEqual(page);
    expect((await list('?pageSize=999')).pageSize).toBe(100);
    expect((await list('?page=999')).items).toEqual([]);
  });

  it('keeps non-public players as unlinked names in frozen rankings and exposes only approved fields', async () => {
    const data = await list('?pageSize=2');
    expect(data.items[0]!.player.slug).toBe(publicPlayerSlug(world.playerIds[0]!));
    expect(data.items[1]!.player.slug).toBeNull();
    expect(data.items[1]!.player.name).toBe(`Public ${world.tag} 001`);
    expect(Object.keys(data.items[0]!.player).sort()).toEqual([...PLAYER_KEYS].sort());
    expect(Object.keys(data.list).sort()).toEqual([...LIST_KEYS].sort());
    expect(sortedPaths(data.items[0])).toEqual([
      'rank', 'previousRank', 'movement', 'points', 'resultsCounted', 'player', ...PLAYER_KEYS.map((key) => `player.${key}`),
      'breakdown', ...['eventSlug', 'eventName', 'eventNameEn', 'eventTypeCode', 'stageCode', 'points', 'earnedAt', 'expiresAt'].map((key) => `breakdown[].${key}`),
    ].sort());
    expect(JSON.stringify(data)).not.toMatch(/internal-ledger-id|private manual reason|birthDate|phone|email|normalizedName|playerId/);
  });

  it('redacts draft or cancelled event labels but preserves the frozen arithmetic', async () => {
    try {
      for (const state of [{ publishStatus: 'DRAFT' as const }, { publishStatus: 'PUBLISHED' as const, isCancelled: true }]) {
        await kit.prisma.event.update({ where: { id: world.eventId }, data: state });
        const row = (await list('?pageSize=1')).items[0]!;
        expect(row.points).toBe(1000);
        expect(row.breakdown[0]).toEqual({ eventSlug: null, eventName: null, eventNameEn: null, eventTypeCode: null, stageCode: 'W', points: 1000, earnedAt: '2099-05-02', expiresAt: '2100-05-02' });
      }
    } finally { await kit.prisma.event.update({ where: { id: world.eventId }, data: { publishStatus: 'PUBLISHED', isCancelled: false } }); }
  });

  it('authorizes frozen event labels by stable identity when a stored slug is renamed and reused', async () => {
    let replacementId: string | undefined;
    const renamedSlug = `${slug}-renamed`;
    try {
      await kit.prisma.event.update({ where: { id: world.eventId }, data: { publishStatus: 'DRAFT', slug: renamedSlug } });
      replacementId = (await kit.prisma.event.create({ data: {
        slug, name: `Replacement ${world.tag}`, eventTypeId: world.eventTypeId,
        startDate: new Date('2099-05-01'), endDate: new Date('2099-05-02'), timezone: 'Asia/Ho_Chi_Minh', publishStatus: 'PUBLISHED',
      } })).id;
      const hidden = (await list('?pageSize=1')).items[0]!.breakdown[0]!;
      expect(hidden).toMatchObject({ eventSlug: null, eventName: null, eventNameEn: null, eventTypeCode: null, points: 1000 });
      await kit.prisma.event.update({ where: { id: world.eventId }, data: { publishStatus: 'PUBLISHED' } });
      const visible = (await list('?pageSize=1')).items[0]!.breakdown[0]!;
      expect(visible).toMatchObject({ eventSlug: renamedSlug, eventName: `Frozen event ${world.tag}`, points: 1000 });
      expect(visible.eventSlug).not.toBe(slug);
    } finally {
      if (replacementId) await kit.prisma.event.delete({ where: { id: replacementId } });
      await kit.prisma.event.update({ where: { id: world.eventId }, data: { slug, publishStatus: 'PUBLISHED' } });
    }
  });

  it('keeps legacy snapshot labels without a stable event id redacted even when their slug is public', async () => {
    const legacy = await createRankingWorld(kit);
    worlds.push(legacy);
    const playerId = world.playerIds[0]!;
    const snapshot = await kit.prisma.rankingSnapshot.create({ data: { rankingListId: legacy.listId, asOfDate: new Date('2099-06-01') } });
    await kit.prisma.rankingSnapshotRow.create({ data: {
      snapshotId: snapshot.id, playerId, rank: 1, points: 88, resultsCounted: 1,
      breakdown: [{ eventSlug: slug, eventName: 'Legacy confidential event', eventTypeCode: 'SECRET', stageCode: 'F', points: 88, earnedAt: '2099-05-02', expiresAt: '2100-05-02' }],
    } });
    await kit.prisma.rankingSnapshot.update({ where: { id: snapshot.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    const legacyCode = (await kit.prisma.rankingList.findUniqueOrThrow({ where: { id: legacy.listId } })).code;
    const data = (await get(`rankings/${legacyCode}`).expect(200)).body.data as PublicRankingList;
    expect(data.items[0]!.breakdown[0]).toMatchObject({ eventSlug: null, eventName: null, eventNameEn: null, eventTypeCode: null, points: 88, stageCode: 'F' });
    expect(JSON.stringify(data)).not.toContain('Legacy confidential event');
  });

  it('filters full club labels at the same 200-character bound as the admin DTO', async () => {
    const playerId = world.playerIds[0]!;
    const original = await kit.prisma.player.findUniqueOrThrow({ where: { id: playerId }, select: { club: true } });
    try {
      for (const length of [100, 101, 200]) {
        const club = `Club ${world.tag} `.padEnd(length, 'x');
        await kit.prisma.player.update({ where: { id: playerId }, data: { club } });
        const filtered = await list(`?club=${encodeURIComponent(club)}`);
        expect(filtered.items.map((row) => row.player.slug)).toEqual([publicPlayerSlug(playerId)]);
        expect(filtered.clubs).toContain(club);
      }
    } finally { await kit.prisma.player.update({ where: { id: playerId }, data: { club: original.club } }); }
  });

  it('returns no unpublished or disabled ranking list, while an active list with no snapshot is empty', async () => {
    try {
      await kit.prisma.rankingList.update({ where: { id: world.listId }, data: { isActive: false } });
      expect((await get(`rankings/${code}`).expect(200)).body.data).toBeNull();
      expect((await get('rankings').expect(200)).body.data.items.some((item: { list: { code: string } }) => item.list.code === code)).toBe(false);
    } finally { await kit.prisma.rankingList.update({ where: { id: world.listId }, data: { isActive: true } }); }
    const empty = await createRankingWorld(kit);
    worlds.push(empty);
    const emptyCode = (await kit.prisma.rankingList.findUniqueOrThrow({ where: { id: empty.listId } })).code;
    expect((await get(`rankings/${emptyCode}`).expect(200)).body.data).toMatchObject({ asOfDate: null, items: [], total: 0 });
    expect((await get(`rankings/unknown-${world.tag}`).expect(200)).body.data).toBeNull();
  });

  it('serves a 50-row page including breakdown below the 80 KB payload budget', async () => {
    const res = await get(`rankings/${code}?pageSize=50`).expect(200);
    expect(res.body.data.items).toHaveLength(50);
    expect(Buffer.byteLength(JSON.stringify(res.body))).toBeLessThanOrEqual(80 * 1024);
    expect(await kit.prisma.rankingSnapshotRow.count({ where: { snapshotId: newest } })).toBe(52);
  });

  it('shows each points cell version in force at event end date only for linked ranking lists', async () => {
    const data = (await get(`events/${slug}/ranking-points`).expect(200)).body.data;
    expect(data.items).toHaveLength(1);
    const rules = data.items[0].rules;
    expect(rules).toEqual(expect.arrayContaining([
      { drawKind: 'MAIN', stageCode: 'W', points: 250, effectiveFrom: '2099-05-02' },
      { drawKind: 'MAIN', stageCode: 'F', points: 50, effectiveFrom: '2098-01-01' },
    ]));
    expect(rules).toHaveLength(2);
    await kit.prisma.subEvent.update({ where: { id: world.subEventId }, data: { rankingListId: null } });
    expect((await get(`events/${slug}/ranking-points`).expect(200)).body.data.items).toEqual([]);
    await kit.prisma.subEvent.update({ where: { id: world.subEventId }, data: { rankingListId: world.listId } });
  });

  it('hides the points table for draft/cancelled events and when the info tab is disabled', async () => {
    try {
      for (const state of [{ publishStatus: 'DRAFT' as const }, { publishStatus: 'PUBLISHED' as const, isCancelled: true }, { isCancelled: false, showInfoTab: false }]) {
        await kit.prisma.event.update({ where: { id: world.eventId }, data: state });
        expect((await get(`events/${slug}/ranking-points`).expect(200)).body.data).toBeNull();
      }
    } finally { await kit.prisma.event.update({ where: { id: world.eventId }, data: { publishStatus: 'PUBLISHED', isCancelled: false, showInfoTab: true } }); }
  });

  it.each(['rankings', 'rankings/any', 'events/any/ranking-points'])('requires the SSR secret for %s', async (path) => {
    await kit.http.get(`${PUBLIC}/${path}`).expect(403);
    await kit.http.get(`${PUBLIC}/${path}`).set(SSR_SECRET_HEADER, 'wrong-secret').expect(403);
  });
});

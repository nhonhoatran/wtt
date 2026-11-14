import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import {
  addEntries,
  addRules,
  cleanupRankingWorld,
  createRankingWorld,
  dirtyAt,
  loadRankingProcessors,
  type RankingDeps,
  type RankingProcessors,
  type RankingWorld,
} from './support/ranking-test-kit.js';
import { createPlayedFinal } from './support/ranking-worker-kit.js';

const API = '/api/v1/admin';
const AS_OF = '2099-06-01';

describe('ranking: pair seed suggestion and player merge (real Postgres)', () => {
  let kit: AuthTestKit;
  let cookie: string;
  let processors: RankingProcessors;
  const worlds: RankingWorld[] = [];
  const deps = (): RankingDeps => ({ prisma: kit.prisma, enqueueRecompute: async () => {} });
  const suggest = (subEventId: string, body: object = {}) => kit.write('post', `${API}/sub-events/${subEventId}/entries/suggest-seeds`, cookie, body);

  /** Writes rows into a DRAFT and promotes it, the only transition the immutability trigger allows. */
  async function publishRows(listId: string, rows: { playerId: string; rank: number; points: number }[]) {
    const snapshot = await kit.prisma.rankingSnapshot.create({ data: { rankingListId: listId, asOfDate: new Date(`${AS_OF}T00:00:00Z`) } });
    await kit.prisma.rankingSnapshotRow.createMany({ data: rows.map((r) => ({ ...r, snapshotId: snapshot.id, resultsCounted: 1, breakdown: [] })) });
    await kit.prisma.rankingSnapshot.update({ where: { id: snapshot.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    return snapshot.id;
  }

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    const admin = await kit.createUser({ role: 'ADMIN' });
    cookie = await kit.signIn(admin);
    await kit.write('post', '/api/v1/auth/step-up', cookie, { password: admin.password }).expect(200);
    processors = await loadRankingProcessors();
  }, 60_000);

  afterAll(async () => {
    if (!kit) return;
    const eventIds = worlds.map((w) => w.eventId);
    const matchIds = (await kit.prisma.match.findMany({ where: { eventId: { in: eventIds } }, select: { id: true } })).map((m) => m.id);
    await kit.prisma.auditLog.deleteMany({ where: { OR: [{ entityId: { in: matchIds } }, { entityId: { in: worlds.map((w) => w.subEventId) } }] } });
    await cleanupRankingWorld(kit, worlds);
    await kit.close();
  }, 60_000);

  it('suggest-seeds is unavailable without a list or a published snapshot, and 404 for an unknown sub-event', async () => {
    const noList = await createRankingWorld(kit, { withList: false });
    const draftOnly = await createRankingWorld(kit);
    worlds.push(noList, draftOnly);
    await kit.prisma.rankingSnapshot.create({ data: { rankingListId: draftOnly.listId, asOfDate: new Date(`${AS_OF}T00:00:00Z`) } });

    for (const w of [noList, draftOnly]) {
      const res = await suggest(w.subEventId).expect(200);
      expect(res.body.data).toEqual({ available: false, suggestions: [] });
    }
    await suggest(randomUUID()).expect(404);
  });

  it('pair seeding sums both players, counts unranked as 0, and leaves rankingAtEntry null', async () => {
    const w = await createRankingWorld(kit, { kind: 'DOUBLES' });
    worlds.push(w);
    const { entryIds, playersByEntry } = await addEntries(kit, w, 3);
    const [[a], [c, d]] = playersByEntry as [string[], string[]];
    await publishRows(w.listId, [
      { playerId: a!, rank: 1, points: 300 },
      { playerId: c!, rank: 2, points: 200 },
      { playerId: d!, rank: 3, points: 50 },
    ]);

    const res = await suggest(w.subEventId).expect(200);
    expect(res.body.data).toMatchObject({ available: true, applied: false, snapshot: { listCode: expect.stringMatching(/^RL-/), asOfDate: AS_OF } });
    const byEntry = new Map<string, { pointsAtEntry: number; rankingAtEntry: number | null }>(res.body.data.suggestions.map((s: { entryId: string }) => [s.entryId, s]));
    expect(byEntry.get(entryIds[0]!)).toMatchObject({ pointsAtEntry: 300, rankingAtEntry: null });
    expect(byEntry.get(entryIds[1]!)).toMatchObject({ pointsAtEntry: 250, rankingAtEntry: null });
    expect(byEntry.get(entryIds[2]!)).toMatchObject({ pointsAtEntry: 0, rankingAtEntry: null, suggestedSeed: null });
    expect(res.body.data.suggestions.map((s: { entryId: string }) => s.entryId)).toEqual([entryIds[0], entryIds[1], entryIds[2]]);

    const stored = await kit.prisma.entry.findMany({ where: { subEventId: w.subEventId }, select: { id: true, pointsAtEntry: true, rankingAtEntry: true } });
    expect(new Map(stored.map((s) => [s.id, `${s.pointsAtEntry}/${s.rankingAtEntry}`]))).toEqual(
      new Map([[entryIds[0]!, '300/null'], [entryIds[1]!, '250/null'], [entryIds[2]!, '0/null']]),
    );
  });

  it('merge: source AUTO rows go, MANUAL rows follow the target, sub-event turns dirty, snapshots keep the source, recompute rebuilds for the target', async () => {
    const { w, playersByEntry } = await createPlayedFinal(kit, worlds);
    await addRules(kit, w, [{ stageCode: 'W', points: 1000 }, { stageCode: 'F', points: 700 }]);
    await processors.recomputeSubEvent(deps(), w.subEventId);
    const source = playersByEntry[0]![0]!;
    const loser = playersByEntry[1]![0]!;
    const manual = await kit.prisma.rankingPointsEarned.create({
      data: {
        rankingListId: w.listId, playerId: source, source: 'MANUAL', points: 50, reason: 'bonus', earnedAt: new Date('2099-05-02T00:00:00Z'), expiresAt: new Date('2100-05-02T00:00:00Z'), createdById: 'ranking-test',
      },
    });
    const snapshotId = await publishRows(w.listId, [{ playerId: source, rank: 1, points: 1050 }, { playerId: loser, rank: 2, points: 700 }]);

    const target = await kit.prisma.player.create({
      data: { code: `RK${w.tag}T`, slug: `rk-${w.tag}-t`, fullName: `Rank Target ${w.tag}`, normalizedName: `rank target ${w.tag}`, gender: 'MALE', countryCode: 'VN' },
    });
    w.playerIds.push(target.id);
    expect(await dirtyAt(kit, w.subEventId)).toBeNull();

    const res = await kit.write('post', `${API}/players/merge`, cookie, { targetId: target.id, sourceId: source, reason: 'duplicate profile' }).expect(200);
    expect(res.body.data).toMatchObject({ targetId: target.id, sourceId: source, movedEntries: 1 });
    expect(res.body.warnings).toContain('RANKING_SNAPSHOT_REBUILD_SUGGESTED');

    const afterMerge = await kit.prisma.rankingPointsEarned.findMany({ where: { rankingListId: w.listId }, select: { id: true, playerId: true, source: true } });
    expect(afterMerge.filter((r) => r.playerId === source)).toEqual([]);
    expect(afterMerge.find((r) => r.id === manual.id)).toMatchObject({ playerId: target.id, source: 'MANUAL' });
    expect(afterMerge.filter((r) => r.source === 'AUTO').map((r) => r.playerId)).toEqual([loser]);
    expect(await dirtyAt(kit, w.subEventId)).not.toBeNull();
    expect(await kit.prisma.rankingSnapshotRow.count({ where: { snapshotId, playerId: source } })).toBe(1);

    await processors.recomputeSubEvent(deps(), w.subEventId);
    const rebuilt = await kit.prisma.rankingPointsEarned.findMany({ where: { rankingListId: w.listId }, select: { playerId: true, source: true, points: true } });
    expect(rebuilt.filter((r) => r.playerId === target.id).map((r) => `${r.source}:${r.points}`).sort()).toEqual(['AUTO:1000', 'MANUAL:50']);
    expect(rebuilt.some((r) => r.playerId === source)).toBe(false);
    expect(await dirtyAt(kit, w.subEventId)).toBeNull();
  });

  it('merge without any ranking data does not suggest a snapshot rebuild', async () => {
    const w = await createRankingWorld(kit);
    worlds.push(w);
    const { playersByEntry } = await addEntries(kit, w, 1);
    const target = await kit.prisma.player.create({
      data: { code: `RK${w.tag}U`, slug: `rk-${w.tag}-u`, fullName: `Rank Target ${w.tag}U`, normalizedName: `rank target ${w.tag}u`, gender: 'MALE', countryCode: 'VN' },
    });
    w.playerIds.push(target.id);
    const res = await kit.write('post', `${API}/players/merge`, cookie, { targetId: target.id, sourceId: playersByEntry[0]![0], reason: 'duplicate' }).expect(200);
    expect(res.body.warnings ?? []).not.toContain('RANKING_SNAPSHOT_REBUILD_SUGGESTED');
  });
});

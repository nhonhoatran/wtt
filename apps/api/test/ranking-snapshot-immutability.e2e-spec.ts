import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { buildKnockout, playRounds } from './support/ranking-draw-builder.js';
import {
  addEntries,
  addRules,
  cleanupRankingWorld,
  createRankingWorld,
  loadRankingProcessors,
  markDirtySql,
  type RankingDeps,
  type RankingProcessors,
  type RankingWorld,
} from './support/ranking-test-kit.js';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const AS_OF = '2099-06-01';

describe('ranking snapshots (real Postgres)', () => {
  let kit: AuthTestKit;
  let worker: RankingProcessors;
  let w: RankingWorld;
  let entryIds: string[];
  const deps = (over: Partial<RankingDeps> = {}): RankingDeps => ({ prisma: kit.prisma, enqueueRecompute: async () => {}, ...over });
  const rows = (snapshotId: string) => kit.prisma.rankingSnapshotRow.findMany({ where: { snapshotId }, orderBy: [{ rank: 'asc' }, { playerId: 'asc' }] });
  const build = async (asOf = AS_OF) => {
    const result = await worker.buildSnapshot(deps(), { listId: w.listId, asOf });
    if (result.outcome !== 'built') throw new Error('snapshot not built');
    return result.snapshotId;
  };

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    worker = await loadRankingProcessors();
    w = await createRankingWorld(kit);
    await addRules(kit, w, [{ stageCode: 'W', points: 1000 }, { stageCode: 'F', points: 700 }, { stageCode: 'SF', points: 400 }]);
    ({ entryIds } = await addEntries(kit, w, 4));
    await playRounds(kit, await buildKnockout(kit, w, { slots: entryIds, codes: ['SF', 'F'] }), () => 1);
    await kit.prisma.subEvent.update({ where: { id: w.subEventId }, data: { rankingDirtyAt: new Date() } });
  });
  afterAll(async () => {
    await cleanupRankingWorld(kit, [w]);
    await kit.close();
  });

  it('recomputes dirty sub-events first, then ranks with ties sharing a rank and keeps a breakdown copy', async () => {
    const snapshotId = await build();
    expect((await kit.prisma.subEvent.findUniqueOrThrow({ where: { id: w.subEventId } })).rankingDirtyAt).toBeNull();

    const result = await rows(snapshotId);
    expect(result.map((r) => [r.points, r.rank])).toEqual([[1000, 1], [700, 2], [400, 3], [400, 3]]);
    expect(result.every((r) => r.previousRank === null && r.movement === null && r.resultsCounted === 1)).toBe(true);
    expect(result[0]!.breakdown).toMatchObject([{ eventId: w.eventId, stageCode: 'W', points: 1000, earnedAt: '2099-05-02', expiresAt: '2100-05-02', eventSlug: `rank-${w.tag}` }]);
    expect(await kit.prisma.rankingSnapshot.findUniqueOrThrow({ where: { id: snapshotId } })).toMatchObject({ status: 'DRAFT' });
  });

  it('omits points expired before asOf and not yet earned', async () => {
    expect((await rows(await build('2100-05-02'))).length).toBe(0);
    expect((await rows(await build('2099-05-01'))).length).toBe(0);
    expect((await rows(await build(AS_OF))).length).toBe(4);
  });

  it('rebuilding the same day replaces the draft instead of adding a second one', async () => {
    const first = await build();
    const second = await build();
    expect(second).not.toBe(first);
    const drafts = await kit.prisma.rankingSnapshot.findMany({ where: { rankingListId: w.listId, asOfDate: new Date(`${AS_OF}T00:00:00Z`), status: 'DRAFT' } });
    expect(drafts.map((d) => d.id)).toEqual([second]);
    expect(await kit.prisma.rankingSnapshotRow.count({ where: { snapshotId: first } })).toBe(0);
  });

  it('refuses the build and names the contents when a change keeps a sub-event dirty', async () => {
    await markDirtySql(kit, w.subEventId);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const writer = kit.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "SubEvent" SET "rankingDirtyAt" = GREATEST(clock_timestamp() AT TIME ZONE 'UTC', "rankingDirtyAt" + interval '1 millisecond') WHERE "id" = ${w.subEventId}`;
      await gate;
    });
    await delay(300);
    const attempt = worker.buildSnapshot(deps(), { listId: w.listId, asOf: AS_OF }).then(() => null, (error: unknown) => error);
    await delay(1_500);
    release();
    await writer;
    const error = (await attempt) as InstanceType<RankingProcessors['SnapshotBlockedError']> | null;
    expect(error).toBeInstanceOf(worker.SnapshotBlockedError);
    expect(error?.subEventIds).toEqual([w.subEventId]);
    await worker.recomputeSubEvent(deps(), w.subEventId);
  });

  it('second snapshot carries previousRank and movement from the latest published one', async () => {
    const first = await build();
    await kit.prisma.rankingSnapshot.update({ where: { id: first }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    await kit.prisma.rankingPointsEarned.create({
      data: { rankingListId: w.listId, playerId: w.playerIds[3]!, source: 'MANUAL', points: 900, reason: 'bonus', earnedAt: new Date('2099-05-03'), expiresAt: new Date('2100-05-03') },
    });
    const newcomer = await kit.prisma.player.create({
      data: { code: `RKN${w.tag}`, slug: `rk-new-${w.tag}`, fullName: `Rank Newcomer ${w.tag}`, normalizedName: 'rank newcomer', gender: 'MALE', countryCode: 'VN' },
    });
    w.playerIds.push(newcomer.id);
    await kit.prisma.rankingPointsEarned.create({
      data: { rankingListId: w.listId, playerId: newcomer.id, source: 'MANUAL', points: 1, reason: 'new', earnedAt: new Date('2099-05-03'), expiresAt: new Date('2100-05-03') },
    });
    const second = await rows(await build('2099-06-02'));
    const old = new Map((await rows(first)).map((r) => [r.playerId, r.rank]));
    for (const row of second) {
      if (row.playerId === newcomer.id) expect([row.previousRank, row.movement]).toEqual([null, null]);
      else expect([row.previousRank, row.movement]).toEqual([old.get(row.playerId), old.get(row.playerId)! - row.rank]);
    }
    expect(second.find((r) => r.playerId === w.playerIds[3])).toMatchObject({ points: 1300, rank: 1 });
  });

  it('DB rejects any change to a published snapshot and its rows', async () => {
    const id = await build('2099-06-03');
    await kit.prisma.rankingSnapshot.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    const row = (await rows(id))[0]!;
    const immutable = /immutable/;

    await expect(kit.prisma.rankingSnapshotRow.update({ where: { snapshotId_playerId: { snapshotId: id, playerId: row.playerId } }, data: { points: 1 } })).rejects.toThrow(immutable);
    await expect(kit.prisma.rankingSnapshotRow.delete({ where: { snapshotId_playerId: { snapshotId: id, playerId: row.playerId } } })).rejects.toThrow(immutable);
    await expect(kit.prisma.rankingSnapshotRow.create({ data: { ...row, playerId: w.playerIds[0]!, snapshotId: id, breakdown: [] } })).rejects.toThrow(immutable);
    await expect(kit.prisma.rankingSnapshot.update({ where: { id }, data: { status: 'DRAFT' } })).rejects.toThrow(immutable);
    await expect(kit.prisma.rankingSnapshot.update({ where: { id }, data: { note: 'x' } })).rejects.toThrow(immutable);
    await expect(kit.prisma.rankingSnapshot.delete({ where: { id } })).rejects.toThrow(immutable);
    await expect(kit.prisma.rankingSnapshot.deleteMany({ where: { id } })).rejects.toThrow(immutable);
    expect(await kit.prisma.rankingSnapshotRow.count({ where: { snapshotId: id } })).toBe((await rows(id)).length);
  });

  it('DB enforces one DRAFT per list and date, and one AUTO row per player and sub-event', async () => {
    const id = await build('2099-06-04');
    await expect(kit.prisma.rankingSnapshot.create({ data: { rankingListId: w.listId, asOfDate: new Date('2099-06-04T00:00:00Z') } })).rejects.toThrow(/Unique constraint|duplicate/i);
    const auto = await kit.prisma.rankingPointsEarned.findFirstOrThrow({ where: { subEventId: w.subEventId, source: 'AUTO' } });
    const copy = { rankingListId: auto.rankingListId, playerId: auto.playerId, subEventId: auto.subEventId, points: auto.points, earnedAt: auto.earnedAt, expiresAt: auto.expiresAt };
    await expect(kit.prisma.rankingPointsEarned.create({ data: { ...copy, source: 'AUTO' } })).rejects.toThrow(/Unique constraint|duplicate/i);
    await expect(kit.prisma.rankingPointsEarned.create({ data: { ...copy, source: 'MANUAL', reason: ' ' } })).rejects.toThrow(/check|violat/i);
    expect(id).toBeTruthy();
  });
});

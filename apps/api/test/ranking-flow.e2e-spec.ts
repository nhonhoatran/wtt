import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { cleanupDraws } from './support/draw-play-helpers.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';
import { playRounds } from './support/ranking-draw-builder.js';
import { deleteSnapshotsOfLists } from './support/ranking-test-kit.js';
import { startRankingTestWorker, waitUntil, type TestRankingWorker } from './support/ranking-worker-kit.js';

const AS_OF = '2020-06-01';
const POINTS = { W: 1000, F: 700, SF: 400, QF: 200, R16: 100 } as const;

interface Format {
  bestOf: number;
  pointsPerGame: number;
}
const straightWin = (f: Format) => Array.from({ length: Math.ceil(f.bestOf / 2) }, () => ({ score1: f.pointsPerGame, score2: 0 }));

describe('ranking end to end: 16-player knockout -> ledger -> draft -> publish -> seed suggestion', () => {
  let kit: AuthTestKit;
  let cookie: string;
  let worker: TestRankingWorker;
  let fx: Fixtures;
  let players: DrawFixtureKit;
  let tierId: string;
  let eventTypeId: string;
  let listId: string;
  let drawId: string;
  let snapshotId: string;

  const ms = () => fx.subEvents.MS!;
  const ws = () => fx.subEvents.WS!;
  const write = (method: 'post' | 'patch', path: string, body: object = {}) => kit.write(method, `${API}${path}`, cookie, body);

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    const admin = await kit.createUser({ role: 'ADMIN' });
    cookie = await kit.signIn(admin);
    await kit.write('post', '/api/v1/auth/step-up', cookie, { password: admin.password }).expect(200);
    worker = await startRankingTestWorker(kit);

    fx = await createEventFixtures(kit, cookie, ['MS', 'WS']);
    players = new DrawFixtureKit(kit, cookie, fx);
    const { prisma } = kit;
    tierId = (await prisma.tier.create({ data: { code: `FT-${fx.tag}`, name: `Flow tier ${fx.tag}`, colorHex: '#123456' } })).id;
    eventTypeId = (await prisma.eventType.create({ data: { code: `FE-${fx.tag}`, name: `Flow type ${fx.tag}`, tierId } })).id;
    listId = (await prisma.rankingList.create({ data: { code: `FL-${fx.tag}`, name: `Flow list ${fx.tag}`, competitorKind: 'SINGLES', genderRule: 'MEN', validityDays: 365 } })).id;
    // Publication is historical; a future test date must not bypass the API's business-date guard.
    await prisma.event.update({ where: { id: fx.eventId }, data: { eventTypeId, startDate: new Date('2020-05-01'), endDate: new Date('2020-05-02') } });
    await prisma.subEvent.updateMany({ where: { eventId: fx.eventId }, data: { rankingListId: listId } });
    await prisma.rankingPointsRule.createMany({
      data: Object.entries(POINTS).map(([stageCode, points]) => ({
        eventTypeId, competitorKind: 'SINGLES' as const, drawKind: 'MAIN' as const, stageCode, points, effectiveFrom: new Date('2000-01-01T00:00:00Z'), createdById: 'ranking-flow-test',
      })),
    });
  }, 120_000);

  afterAll(async () => {
    if (!kit) return;
    await worker?.stop();
    const { prisma } = kit;
    const matchIds = (await prisma.match.findMany({ where: { eventId: fx?.eventId }, select: { id: true } })).map((m) => m.id);
    await prisma.auditLog.deleteMany({ where: { entityId: { in: matchIds } } });
    await cleanupDraws(kit, Object.values(fx?.subEvents ?? {}), fx?.eventId);
    if (listId) {
      await deleteSnapshotsOfLists(kit, [listId]);
      await prisma.rankingPointsEarned.deleteMany({ where: { rankingListId: listId } });
      await prisma.subEvent.updateMany({ where: { eventId: fx?.eventId }, data: { rankingListId: null } });
    }
    await cleanupFixtures(kit, fx, [snapshotId, listId].filter(Boolean));
    if (listId) await prisma.rankingList.deleteMany({ where: { id: listId } });
    if (eventTypeId) {
      await prisma.rankingPointsRule.deleteMany({ where: { eventTypeId } });
      await prisma.eventType.deleteMany({ where: { id: eventTypeId } });
      await prisma.tier.deleteMany({ where: { id: tierId } });
    }
    await kit.close();
  }, 60_000);

  it('plays the draw out and confirms the final through the API, which recomputes the ledger through the queue', async () => {
    await players.addEntries(ms(), 0, 16, { seeds: 2 });
    const created = await write('post', `/sub-events/${ms()}/draws`, { kind: 'MAIN', seedCount: 2 }).expect(201);
    drawId = created.body.data.id;
    await write('post', `/draws/${drawId}/publish`, { expectedVersion: created.body.data.version }).expect(200);

    const rounds = await kit.prisma.round.findMany({
      where: { drawId },
      orderBy: { number: 'asc' },
      include: { matches: { orderBy: { orderInRound: 'asc' }, select: { id: true } } },
    });
    expect(rounds.map((r) => r.code)).toEqual(['R16', 'QF', 'SF', 'F']);
    const built = { drawId, rounds: rounds.map((r) => ({ number: r.number, code: r.code, matchIds: r.matches.map((m) => m.id) })) };
    await playRounds(kit, built, () => 1, { through: 3 });
    expect(await kit.prisma.rankingPointsEarned.count({ where: { rankingListId: listId } })).toBe(0);

    const finalId = built.rounds[3]!.matchIds[0]!;
    const final = await kit.prisma.match.findUniqueOrThrow({ where: { id: finalId } });
    const format = (await kit.get(`${API}/matches/${finalId}`, cookie).expect(200)).body.data.format as Format;
    await write('post', `/matches/${finalId}/confirm`, { expectedVersion: final.version, resultType: 'NORMAL', games: straightWin(format) }).expect(200);

    await waitUntil(async () => (await kit.prisma.rankingPointsEarned.count({ where: { rankingListId: listId } })) === 16, 'ledger rows from the queue');
    const ledger = await kit.prisma.rankingPointsEarned.findMany({ where: { rankingListId: listId } });
    expect(ledger.map((r) => r.points).sort((a, b) => b - a)).toEqual([1000, 700, 400, 400, 200, 200, 200, 200, ...Array<number>(8).fill(100)]);
    expect(ledger.every((r) => r.source === 'AUTO' && r.eventId === fx.eventId && r.subEventId === ms())).toBe(true);
    await waitUntil(async () => (await kit.prisma.$queryRaw<{ t: string | null }[]>`SELECT "rankingDirtyAt"::text AS t FROM "SubEvent" WHERE "id" = ${ms()}`)[0]?.t === null, 'dirty mark cleared');
  }, 60_000);

  it('builds a draft, previews ranks with ties and a breakdown, and publishes it', async () => {
    const res = await write('post', '/ranking-snapshots/drafts', { listIds: [listId], asOfDate: AS_OF }).expect(202);
    const { jobId } = res.body.data.jobs[0];
    await waitUntil(async () => (await kit.get(`${API}/ranking/jobs/${jobId}`, cookie)).body.data?.state === 'completed', 'snapshot job');
    snapshotId = (await kit.prisma.rankingSnapshot.findFirstOrThrow({ where: { rankingListId: listId, status: 'DRAFT' } })).id;

    const rows = (await kit.get(`${API}/ranking-snapshots/${snapshotId}/rows?sort=rank:asc&pageSize=50`, cookie).expect(200)).body.data as {
      rank: number;
      points: number;
      resultsCounted: number;
      breakdown: { stageCode: string; points: number; eventTypeCode: string }[];
    }[];
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 3, 5, 5, 5, 5, ...Array<number>(8).fill(9)]);
    expect(rows.map((r) => r.points)).toEqual([1000, 700, 400, 400, 200, 200, 200, 200, ...Array<number>(8).fill(100)]);
    expect(rows[0]).toMatchObject({ resultsCounted: 1, breakdown: [{ stageCode: 'W', points: 1000, eventTypeCode: `FE-${fx.tag}` }] });

    const published = await write('post', `/ranking-snapshots/${snapshotId}/publish`).expect(200);
    expect(published.body.data).toMatchObject({ id: snapshotId, status: 'PUBLISHED', changedPlayers: 16 });
  }, 60_000);

  it('suggests seeds from the published snapshot and applies them on a sub-event sharing the list', async () => {
    const entryIds = await players.addEntries(ws(), 0, 8);
    const rowByPlayer = new Map((await kit.prisma.rankingSnapshotRow.findMany({ where: { snapshotId } })).map((r) => [r.playerId, r]));
    const playerOfEntry = new Map(
      (await kit.prisma.entry.findMany({ where: { id: { in: entryIds } }, select: { id: true, competitor: { select: { playerId: true } } } })).map((e) => [e.id, e.competitor.playerId!]),
    );

    const preview = (await write('post', `/sub-events/${ws()}/entries/suggest-seeds`).expect(200)).body.data;
    expect(preview).toMatchObject({ available: true, applied: false, snapshot: { id: snapshotId, asOfDate: AS_OF } });
    expect(preview.seedCount).toBeGreaterThan(0);
    const list = preview.suggestions as { entryId: string; pointsAtEntry: number; rankingAtEntry: number | null; suggestedSeed: number | null }[];
    expect(list).toHaveLength(8);
    for (const s of list) {
      const row = rowByPlayer.get(playerOfEntry.get(s.entryId)!)!;
      expect(s).toMatchObject({ pointsAtEntry: row.points, rankingAtEntry: row.rank });
    }
    expect(list.map((s) => s.pointsAtEntry)).toEqual([...list.map((s) => s.pointsAtEntry)].sort((a, b) => b - a));
    const seeded = list.filter((s) => s.suggestedSeed !== null);
    expect(seeded.map((s) => s.suggestedSeed)).toEqual(seeded.map((_, i) => i + 1));
    expect(seeded).toHaveLength(preview.seedCount);
    expect(await kit.prisma.entry.count({ where: { subEventId: ws(), seed: { not: null } } })).toBe(0);

    const applied = (await write('post', `/sub-events/${ws()}/entries/suggest-seeds`, { apply: true }).expect(200)).body.data;
    expect(applied.applied).toBe(true);
    const stored = await kit.prisma.entry.findMany({ where: { subEventId: ws(), seed: { not: null } }, select: { id: true, seed: true } });
    expect(new Map(stored.map((e) => [e.id, e.seed]))).toEqual(new Map(seeded.map((s) => [s.entryId, s.suggestedSeed])));
  }, 60_000);
});

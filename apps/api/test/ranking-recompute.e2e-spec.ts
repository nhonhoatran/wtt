import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { buildGroup, buildKnockout, playRounds } from './support/ranking-draw-builder.js';
import {
  addEntries,
  addRules,
  cleanupRankingWorld,
  createRankingWorld,
  loadRankingProcessors,
  type RankingDeps,
  type RankingProcessors,
  type RankingWorld,
} from './support/ranking-test-kit.js';

const KNOCKOUT_RULES = [
  { stageCode: 'W', points: 1000 },
  { stageCode: 'F', points: 700 },
  { stageCode: 'SF', points: 400 },
  { stageCode: 'QF', points: 200 },
];
const side1Wins = () => 1 as const;

describe('ranking recompute (real Postgres)', () => {
  let kit: AuthTestKit;
  let worker: RankingProcessors;
  const worlds: RankingWorld[] = [];
  const deps = (over: Partial<RankingDeps> = {}): RankingDeps => ({ prisma: kit.prisma, enqueueRecompute: async () => {}, ...over });
  const world = async (options: Parameters<typeof createRankingWorld>[1] = {}) => {
    const created = await createRankingWorld(kit, options);
    worlds.push(created);
    return created;
  };
  const ledger = async (w: RankingWorld) =>
    (await kit.prisma.rankingPointsEarned.findMany({ where: { subEventId: w.subEventId }, include: { entry: { select: { id: true } } } })).map((r) => ({
      entryId: r.entryId!,
      playerId: r.playerId,
      stage: r.stageCode,
      points: r.points,
      source: r.source,
    }));
  const byEntry = (rows: Awaited<ReturnType<typeof ledger>>) => new Map(rows.map((r) => [r.entryId, `${r.stage}:${r.points}`]));

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    worker = await loadRankingProcessors();
  });
  afterAll(async () => {
    await cleanupRankingWorld(kit, worlds);
    await kit.close();
  });

  it('writes W/F/SF/QF rows from a played 8-entry draw with frozen dates, and is idempotent', async () => {
    const w = await world();
    await addRules(kit, w, KNOCKOUT_RULES);
    const { entryIds } = await addEntries(kit, w, 8);
    await playRounds(kit, await buildKnockout(kit, w, { slots: entryIds, codes: ['QF', 'SF', 'F'] }), side1Wins);

    expect(await worker.recomputeSubEvent(deps(), w.subEventId)).toBe('recomputed');
    const first = byEntry(await ledger(w));
    expect(first.get(entryIds[0]!)).toBe('W:1000');
    expect(first.get(entryIds[4]!)).toBe('F:700');
    expect([first.get(entryIds[2]!), first.get(entryIds[6]!)]).toEqual(['SF:400', 'SF:400']);
    expect([1, 3, 5, 7].map((i) => first.get(entryIds[i]!))).toEqual(Array(4).fill('QF:200'));

    const row = await kit.prisma.rankingPointsEarned.findFirstOrThrow({ where: { subEventId: w.subEventId } });
    expect([row.earnedAt, row.expiresAt].map((d) => d.toISOString().slice(0, 10))).toEqual(['2099-05-02', '2100-05-02']);

    await worker.recomputeSubEvent(deps(), w.subEventId);
    expect(byEntry(await ledger(w))).toEqual(first);
    expect(await kit.prisma.rankingPointsEarned.count({ where: { subEventId: w.subEventId } })).toBe(8);
  });

  it('skips entries still playing', async () => {
    const w = await world();
    await addRules(kit, w, KNOCKOUT_RULES);
    const { entryIds } = await addEntries(kit, w, 8);
    await playRounds(kit, await buildKnockout(kit, w, { slots: entryIds, codes: ['QF', 'SF', 'F'] }), side1Wins, { through: 1 });
    await worker.recomputeSubEvent(deps(), w.subEventId);
    expect([...byEntry(await ledger(w)).keys()].sort()).toEqual([1, 3, 5, 7].map((i) => entryIds[i]!).sort());
  });

  it('doubles: one ledger row per player of the pair', async () => {
    const w = await world({ kind: 'DOUBLES' });
    await addRules(kit, w, KNOCKOUT_RULES);
    const { entryIds, playersByEntry } = await addEntries(kit, w, 4);
    await playRounds(kit, await buildKnockout(kit, w, { slots: entryIds, codes: ['SF', 'F'] }), side1Wins);
    await worker.recomputeSubEvent(deps(), w.subEventId);
    const rows = await ledger(w);
    expect(rows).toHaveLength(8);
    for (const player of playersByEntry[0]!) expect(rows.filter((r) => r.playerId === player).map((r) => r.stage)).toEqual(['W']);
  });

  it('result changed straight in the DB: recompute leaves no stale rows', async () => {
    const w = await world();
    await addRules(kit, w, KNOCKOUT_RULES);
    const { entryIds } = await addEntries(kit, w, 4);
    const built = await buildKnockout(kit, w, { slots: entryIds, codes: ['SF', 'F'] });
    await playRounds(kit, built, side1Wins);
    await worker.recomputeSubEvent(deps(), w.subEventId);
    expect(byEntry(await ledger(w)).get(entryIds[0]!)).toBe('W:1000');

    await kit.prisma.match.update({ where: { id: built.rounds[1]!.matchIds[0]! }, data: { winnerSide: 2 } });
    await worker.recomputeSubEvent(deps(), w.subEventId);
    const after = byEntry(await ledger(w));
    expect(after.size).toBe(4);
    expect(after.get(entryIds[0]!)).toBe('F:700');
    expect(after.get(entryIds[2]!)).toBe('W:1000');
  });

  it('applies the rule version in force at the event end date and re-freezes when the date moves', async () => {
    const w = await world();
    await addRules(kit, w, [
      { stageCode: 'W', points: 1000, effectiveFrom: '2000-01-01' },
      { stageCode: 'W', points: 1500, effectiveFrom: '2099-06-01' },
    ]);
    const { entryIds } = await addEntries(kit, w, 2);
    await playRounds(kit, await buildKnockout(kit, w, { slots: entryIds, codes: ['F'] }), side1Wins);
    const winnerRow = () => kit.prisma.rankingPointsEarned.findFirstOrThrow({ where: { subEventId: w.subEventId, stageCode: 'W' } });

    await worker.recomputeSubEvent(deps(), w.subEventId);
    expect((await winnerRow()).points).toBe(1000);
    await kit.prisma.event.update({ where: { id: w.eventId }, data: { endDate: new Date('2099-07-01T00:00:00Z') } });
    await worker.recomputeSubEvent(deps(), w.subEventId);
    const later = await winnerRow();
    expect([later.points, later.ruleEffectiveFrom?.toISOString().slice(0, 10)]).toEqual([1500, '2099-06-01']);
    await kit.prisma.event.update({ where: { id: w.eventId }, data: { endDate: new Date('2099-05-02T00:00:00Z') } });
    await worker.recomputeSubEvent(deps(), w.subEventId);
    expect((await winnerRow()).points).toBe(1000);
  });

  it('cancelled event or missing list earns nothing; MANUAL rows survive; unknown id is reported', async () => {
    const cancelled = await world({ isCancelled: true });
    const noList = await world({ withList: false });
    for (const w of [cancelled, noList]) {
      await addRules(kit, w, KNOCKOUT_RULES);
      const { entryIds } = await addEntries(kit, w, 2);
      await playRounds(kit, await buildKnockout(kit, w, { slots: entryIds, codes: ['F'] }), side1Wins);
    }
    const manual = await kit.prisma.rankingPointsEarned.create({
      data: { rankingListId: cancelled.listId, playerId: cancelled.playerIds[0]!, source: 'MANUAL', points: 50, reason: 'history', earnedAt: new Date('2099-01-01'), expiresAt: new Date('2100-01-01') },
    });
    for (const w of [cancelled, noList]) await worker.recomputeSubEvent(deps(), w.subEventId);
    expect(await ledger(noList)).toEqual([]);
    expect(await kit.prisma.rankingPointsEarned.findMany({ where: { rankingListId: cancelled.listId } })).toMatchObject([{ id: manual.id }]);
    expect(await worker.recomputeSubEvent(deps(), '00000000-0000-4000-8000-000000000000')).toBe('missing');
  });

  it('group stage: GROUP-n per final rank when enabled, plain GROUP otherwise, nothing while unfinished', async () => {
    const w = await world({ groupStageByRank: true });
    await addRules(kit, w, [
      { stageCode: 'GROUP-3', points: 100, drawKind: 'GROUP' },
      { stageCode: 'GROUP-4', points: 50, drawKind: 'GROUP' },
      { stageCode: 'GROUP', points: 80, drawKind: 'GROUP' },
    ]);
    const { entryIds } = await addEntries(kit, w, 4);
    await buildGroup(kit, w, { entryIds, qualifiedCount: 2, finished: false });
    await worker.recomputeSubEvent(deps(), w.subEventId);
    expect(await ledger(w)).toEqual([]);

    await kit.prisma.match.updateMany({ where: { subEventId: w.subEventId, status: 'SCHEDULED' }, data: { status: 'OFFICIAL', resultType: 'NORMAL', winnerSide: 1 } });
    await worker.recomputeSubEvent(deps(), w.subEventId);
    expect([...byEntry(await ledger(w))]).toEqual(expect.arrayContaining([[entryIds[2], 'GROUP-3:100'], [entryIds[3], 'GROUP-4:50']]));
    await kit.prisma.rankingList.update({ where: { id: w.listId }, data: { groupStageByRank: false } });
    await worker.recomputeSubEvent(deps(), w.subEventId);
    expect([...byEntry(await ledger(w)).values()].sort()).toEqual(['GROUP:80', 'GROUP:80']);
  });
});

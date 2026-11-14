import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { buildKnockout, playRounds } from './support/ranking-draw-builder.js';
import {
  addEntries,
  addRules,
  cleanupRankingWorld,
  createRankingWorld,
  dirtyAt,
  loadRankingProcessors,
  markDirtySql,
  type RankingDeps,
  type RankingProcessors,
  type RankingWorld,
} from './support/ranking-test-kit.js';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('ranking dirty mark, compare-and-clear and sweep (real Postgres)', () => {
  let kit: AuthTestKit;
  let worker: RankingProcessors;
  let w: RankingWorld;
  const deps = (over: Partial<RankingDeps> = {}): RankingDeps => ({ prisma: kit.prisma, enqueueRecompute: async () => {}, ...over });

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    worker = await loadRankingProcessors();
    w = await createRankingWorld(kit);
    await addRules(kit, w, [{ stageCode: 'W', points: 1000 }, { stageCode: 'F', points: 700 }]);
    const { entryIds } = await addEntries(kit, w, 2);
    await playRounds(kit, await buildKnockout(kit, w, { slots: entryIds, codes: ['F'] }), () => 1);
  });
  afterAll(async () => {
    await cleanupRankingWorld(kit, [w]);
    await kit.close();
  });

  it('marker value is UTC and strictly increases at the timestamp(3) precision of the column', async () => {
    const [probe] = await kit.prisma.$queryRaw<{ tz: string; utc: string }[]>`SELECT current_setting('TimeZone') AS tz, (clock_timestamp() AT TIME ZONE 'UTC')::text AS utc`;
    const { tz, utc } = probe!;
    await markDirtySql(kit, w.subEventId);
    const first = (await dirtyAt(kit, w.subEventId))!;
    expect(Math.abs(Date.parse(`${first.replace(' ', 'T')}Z`) - Date.parse(`${utc.replace(' ', 'T')}Z`))).toBeLessThan(5_000);

    let previous = first;
    for (let i = 0; i < 300; i += 1) {
      await markDirtySql(kit, w.subEventId);
      const current = (await dirtyAt(kit, w.subEventId))!;
      expect(current > previous, `${previous} -> ${current} (session tz ${tz})`).toBe(true);
      previous = current;
    }
    // Two marks inside one transaction share one statement clock only for now(); clock_timestamp() must still advance.
    await kit.prisma.$transaction(async (tx) => {
      const mark = () => tx.$executeRaw`UPDATE "SubEvent" SET "rankingDirtyAt" = GREATEST(clock_timestamp() AT TIME ZONE 'UTC', "rankingDirtyAt" + interval '1 millisecond') WHERE "id" = ${w.subEventId}`;
      const read = async () => (await tx.$queryRaw<{ t: string }[]>`SELECT "rankingDirtyAt"::text AS t FROM "SubEvent" WHERE "id" = ${w.subEventId}`)[0]!.t;
      await mark();
      const a = await read();
      await mark();
      expect((await read()) > a).toBe(true);
    });
  });

  it('a mark committed while a recompute runs survives the clear; the next run clears it', async () => {
    await markDirtySql(kit, w.subEventId);
    const started = (await dirtyAt(kit, w.subEventId))!;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let newer = '';
    // Holds a row-level (non-key) lock on the SubEvent: the recompute can read and write the ledger but its clear waits.
    const writer = kit.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "SubEvent" SET "rankingDirtyAt" = GREATEST(clock_timestamp() AT TIME ZONE 'UTC', "rankingDirtyAt" + interval '1 millisecond') WHERE "id" = ${w.subEventId}`;
      newer = (await tx.$queryRaw<{ t: string }[]>`SELECT "rankingDirtyAt"::text AS t FROM "SubEvent" WHERE "id" = ${w.subEventId}`)[0]!.t;
      await gate;
    });
    await delay(300);
    const run = worker.recomputeSubEvent(deps(), w.subEventId);
    await delay(1_500);
    release();
    await writer;
    expect(await run).toBe('recomputed');

    expect(newer > started).toBe(true);
    expect(await dirtyAt(kit, w.subEventId)).toBe(newer);
    await worker.recomputeSubEvent(deps(), w.subEventId);
    expect(await dirtyAt(kit, w.subEventId)).toBeNull();
  });

  it('sweep re-enqueues only stale marks; the recompute it triggers fixes the ledger and clears the mark', async () => {
    await kit.prisma.rankingPointsEarned.deleteMany({ where: { subEventId: w.subEventId } });
    await markDirtySql(kit, w.subEventId);
    const seen: string[] = [];
    const enqueueRecompute = async (id: string) => void seen.push(id);

    const fresh = await worker.sweepDirtySubEvents(deps({ enqueueRecompute }));
    expect(seen).not.toContain(w.subEventId);
    expect(fresh.failed).toBe(0);

    const later = new Date(Date.now() + 24 * 3_600_000);
    await worker.sweepDirtySubEvents(deps({ enqueueRecompute, now: () => later }));
    expect(seen).toContain(w.subEventId);

    await worker.recomputeSubEvent(deps(), w.subEventId);
    expect(await dirtyAt(kit, w.subEventId)).toBeNull();
    expect(await kit.prisma.rankingPointsEarned.count({ where: { subEventId: w.subEventId } })).toBe(2);
  });

  it('a failing enqueue fails the sweep so the job is retried', async () => {
    await markDirtySql(kit, w.subEventId);
    const later = new Date(Date.now() + 24 * 3_600_000);
    await expect(
      worker.sweepDirtySubEvents(deps({ now: () => later, enqueueRecompute: async () => { throw new Error('redis down'); } })),
    ).rejects.toThrow(/enqueue/);
    await worker.recomputeSubEvent(deps(), w.subEventId);
  });
});

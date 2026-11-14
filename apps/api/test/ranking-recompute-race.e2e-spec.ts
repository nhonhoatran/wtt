import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RANKING_RECOMPUTE_DELAYED, RankingEnqueueService } from '../src/modules/ranking-jobs/ranking-enqueue.service.js';
import { AuthTestKit } from './support/auth-test-kit.js';
import { buildKnockout, playRounds } from './support/ranking-draw-builder.js';
import { addEntries, addRules, cleanupRankingWorld, createRankingWorld, dirtyAt, markDirtySql, type RankingWorld } from './support/ranking-test-kit.js';
import { startRankingTestWorker, waitUntil, type TestRankingWorker } from './support/ranking-worker-kit.js';

describe('ranking recompute queue (real Redis + Postgres)', () => {
  let kit: AuthTestKit;
  let enqueuer: RankingEnqueueService;
  let worker: TestRankingWorker;
  const worlds: RankingWorld[] = [];

  const finalWinner = async (w: RankingWorld) => {
    const rows = await kit.prisma.rankingPointsEarned.findMany({ where: { subEventId: w.subEventId, stageCode: 'W' } });
    return rows.map((r) => r.entryId);
  };
  const doneFor = (w: RankingWorld) => worker.completed.filter((job) => job.data.subEventId === w.subEventId);

  async function playedFinal() {
    const w = await createRankingWorld(kit);
    worlds.push(w);
    await addRules(kit, w, [{ stageCode: 'W', points: 1000 }, { stageCode: 'F', points: 700 }]);
    const { entryIds } = await addEntries(kit, w, 2);
    const built = await buildKnockout(kit, w, { slots: entryIds, codes: ['F'] });
    await playRounds(kit, built, () => 1);
    return { w, entryIds, finalId: built.rounds[0]!.matchIds[0]! };
  }

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    enqueuer = kit.app.get(RankingEnqueueService);
    worker = await startRankingTestWorker(kit, { concurrency: 4 });
  });
  afterAll(async () => {
    await worker.stop();
    await cleanupRankingWorld(kit, worlds);
    await kit.close();
  });

  it('a second recompute enqueued after the first completed and is still retained also runs', async () => {
    const { w, entryIds, finalId } = await playedFinal();
    expect(await enqueuer.enqueueRecompute([w.subEventId])).toEqual([]);
    await waitUntil(() => doneFor(w).length === 1, 'first recompute');
    expect(await finalWinner(w)).toEqual([entryIds[0]]);
    const firstId = doneFor(w)[0]!.id;
    expect((await enqueuer.jobStatus(firstId)).state).toBe('completed');

    await kit.prisma.match.update({ where: { id: finalId }, data: { winnerSide: 2 } });
    await markDirtySql(kit, w.subEventId);
    expect(await enqueuer.enqueueRecompute([w.subEventId])).toEqual([]);
    await waitUntil(() => doneFor(w).length === 2, 'second recompute');

    expect(doneFor(w)[1]!.id).not.toBe(firstId);
    expect(await finalWinner(w)).toEqual([entryIds[1]]);
    expect(await dirtyAt(kit, w.subEventId)).toBeNull();
  });

  it('a burst of recomputes for one sub-event serialises and leaves exactly one set of rows', async () => {
    const { w, entryIds, finalId } = await playedFinal();
    await kit.prisma.match.update({ where: { id: finalId }, data: { winnerSide: 2 } });
    await markDirtySql(kit, w.subEventId);
    await Promise.all(Array.from({ length: 5 }, () => enqueuer.enqueueRecompute([w.subEventId])));
    await waitUntil(() => doneFor(w).length === 5, 'burst end');

    expect(worker.failed.filter((job) => job.reason.includes(w.subEventId))).toEqual([]);
    expect(await kit.prisma.rankingPointsEarned.count({ where: { subEventId: w.subEventId } })).toBe(2);
    expect(await finalWinner(w)).toEqual([entryIds[1]]);
  });

  it('enqueue reports a warning instead of throwing when Redis is unreachable', async () => {
    const offline = new RankingEnqueueService({ REDIS_URL: 'redis://127.0.0.1:1', QUEUE_PREFIX: 'ranking-offline-test' } as never);
    try {
      expect(await offline.enqueueRecompute(['00000000-0000-4000-8000-000000000000'])).toEqual([RANKING_RECOMPUTE_DELAYED]);
    } finally {
      await offline.onModuleDestroy();
    }
  });
});

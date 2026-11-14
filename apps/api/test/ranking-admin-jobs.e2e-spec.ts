import { QueueName, RANKING_SNAPSHOT_JOB } from '@kamito/shared';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API_ENV } from '../src/common/config/app-config.module.js';
import type { ApiEnv } from '../src/common/config/env-schema.js';
import { AuthTestKit } from './support/auth-test-kit.js';
import { addRules, cleanupRankingWorld, dirtyAt, type RankingWorld } from './support/ranking-test-kit.js';
import { createPlayedFinal, startRankingTestWorker, waitUntil, type TestRankingWorker } from './support/ranking-worker-kit.js';

const API = '/api/v1/admin';

describe('admin ranking recompute and job status', () => {
  let kit: AuthTestKit;
  let worker: TestRankingWorker;
  let queue: Queue;
  let cookie: string;
  let operatorCookie: string;
  const worlds: RankingWorld[] = [];

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operatorCookie = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    worker = await startRankingTestWorker(kit);
    const env = kit.app.get<ApiEnv>(API_ENV);
    queue = new Queue(QueueName.Ranking, { connection: { url: env.REDIS_URL }, prefix: env.QUEUE_PREFIX });
  });
  afterAll(async () => {
    await worker.stop();
    await queue.close();
    await cleanupRankingWorld(kit, worlds);
    await kit.close();
  });

  it('every ranking route is closed to RESULTS_OPERATOR', async () => {
    const id = randomUUID();
    const reads = ['ranking-lists', `ranking-lists/${id}`, 'ranking-rules?filter[competitorKind]=SINGLES&filter[drawKind]=MAIN', 'ranking-points', 'ranking-snapshots', `ranking-snapshots/${id}`, `ranking-snapshots/${id}/rows`, 'ranking/jobs/rank-x'];
    for (const path of reads) expect({ path, status: (await kit.get(`${API}/${path}`, operatorCookie)).status }).toEqual({ path, status: 403 });
    const writes: [Parameters<AuthTestKit['write']>[0], string][] = [
      ['post', 'ranking-lists'], ['patch', `ranking-lists/${id}`], ['delete', `ranking-lists/${id}`], ['put', 'ranking-rules/matrix'],
      ['post', 'ranking-points'], ['delete', `ranking-points/${id}`], ['post', 'ranking-snapshots/drafts'],
      ['post', `ranking-snapshots/${id}/publish`], ['delete', `ranking-snapshots/${id}`], ['post', 'ranking/recompute'],
    ];
    for (const [method, path] of writes) {
      expect({ path, status: (await kit.write(method, `${API}/${path}`, operatorCookie)).status }).toEqual({ path, status: 403 });
    }
    await kit.get(`${API}/ranking-lists`).expect(401);
  });

  it('manual recompute by sub-event or event type marks dirty, queues, audits and lands in the ledger', async () => {
    const { w } = await createPlayedFinal(kit, worlds);
    await addRules(kit, w, [{ stageCode: 'W', points: 1000 }]);

    const bySubEvent = await kit.write('post', `${API}/ranking/recompute`, cookie, { subEventId: w.subEventId }).expect(202);
    expect(bySubEvent.body.data.subEventIds).toEqual([w.subEventId]);
    expect(bySubEvent.body.warnings).toBeUndefined();
    await waitUntil(async () => (await dirtyAt(kit, w.subEventId)) === null && worker.completed.some((j) => j.data.subEventId === w.subEventId), 'first recompute');
    expect(await kit.prisma.rankingPointsEarned.count({ where: { subEventId: w.subEventId } })).toBe(1);
    expect(await kit.prisma.auditLog.count({ where: { action: 'ranking.recompute', entityId: w.subEventId } })).toBe(1);

    const byType = await kit.write('post', `${API}/ranking/recompute`, cookie, { eventTypeId: w.eventTypeId }).expect(202);
    expect(byType.body.data.subEventIds).toEqual([w.subEventId]);
    await waitUntil(() => worker.completed.filter((j) => j.data.subEventId === w.subEventId).length === 2, 'second recompute');

    await kit.write('post', `${API}/ranking/recompute`, cookie, {}).expect(422);
    await kit.write('post', `${API}/ranking/recompute`, cookie, { subEventId: w.subEventId, eventTypeId: w.eventTypeId }).expect(422);
    await kit.write('post', `${API}/ranking/recompute`, cookie, { subEventId: randomUUID() }).expect(404);
  });

  it('exposes job state, including the failure reason of a failed job', async () => {
    const { w } = await createPlayedFinal(kit, worlds);
    await kit.write('post', `${API}/ranking/recompute`, cookie, { subEventId: w.subEventId }).expect(202);
    await waitUntil(() => worker.completed.some((j) => j.data.subEventId === w.subEventId), 'recompute job');
    const done = worker.completed.find((j) => j.data.subEventId === w.subEventId)!;
    const status = await kit.get(`${API}/ranking/jobs/${done.id}`, cookie).expect(200);
    expect(status.body.data).toMatchObject({ id: done.id, state: 'completed', failedReason: null, result: { outcome: 'recomputed' } });

    const failingId = `rank-snap-test-${randomUUID()}`;
    await queue.add(RANKING_SNAPSHOT_JOB, { listId: w.listId, asOf: 'not-a-date' }, { jobId: failingId, attempts: 1, removeOnFail: { count: 5 } });
    await waitUntil(async () => (await kit.get(`${API}/ranking/jobs/${failingId}`, cookie)).body.data?.state === 'failed', 'failed job');
    const failed = await kit.get(`${API}/ranking/jobs/${failingId}`, cookie).expect(200);
    expect(failed.body.data.failedReason).toContain('invalid asOf date');
    await (await queue.getJob(failingId))?.remove();

    await kit.get(`${API}/ranking/jobs/rank-snap-missing`, cookie).expect(404);
    await kit.get(`${API}/ranking/jobs/not-a-ranking-job`, cookie).expect(404);
  });
});

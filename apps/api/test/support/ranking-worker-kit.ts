import { RANKING_RECOMPUTE_JOB, QueueName } from '@kamito/shared';
import { Worker, type Job } from 'bullmq';
import { API_ENV } from '../../src/common/config/app-config.module.js';
import type { ApiEnv } from '../../src/common/config/env-schema.js';
import type { AuthTestKit } from './auth-test-kit.js';
import { buildKnockout, playRounds } from './ranking-draw-builder.js';
import { addEntries, createRankingWorld, loadRankingProcessors, type RankingDeps, type RankingWorld, type WorldOptions } from './ranking-test-kit.js';

export interface TestRankingWorker {
  completed: { id: string; name: string; data: Record<string, string> }[];
  failed: { id: string; reason: string }[];
  stop(): Promise<void>;
}

/** A real BullMQ worker on the dev Redis running the real processors, so API enqueues are consumed end to end. */
export async function startRankingTestWorker(kit: AuthTestKit, options: { concurrency?: number } = {}): Promise<TestRankingWorker> {
  const env = kit.app.get<ApiEnv>(API_ENV);
  const processors = await loadRankingProcessors();
  const deps: RankingDeps = { prisma: kit.prisma, enqueueRecompute: async () => {} };
  const completed: TestRankingWorker['completed'] = [];
  const failed: TestRankingWorker['failed'] = [];

  const worker = new Worker(
    QueueName.Ranking,
    async (job: Job<Record<string, string>>) => {
      if (job.name === RANKING_RECOMPUTE_JOB) return { outcome: await processors.recomputeSubEvent(deps, job.data.subEventId!) };
      return processors.buildSnapshot(deps, { listId: job.data.listId!, asOf: job.data.asOf! });
    },
    { connection: { url: env.REDIS_URL }, prefix: env.QUEUE_PREFIX, concurrency: options.concurrency ?? 1 },
  );
  worker.on('completed', (job) => completed.push({ id: job.id!, name: job.name, data: job.data }));
  worker.on('failed', (job, error) => failed.push({ id: job?.id ?? '?', reason: error.message }));
  await worker.waitUntilReady();
  return { completed, failed, stop: () => worker.close() };
}

export async function waitUntil(check: () => boolean | Promise<boolean>, what: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** A two-entry knockout whose final is already played (entry 0 wins); the world is registered for cleanup. */
export async function createPlayedFinal(kit: AuthTestKit, worlds: RankingWorld[], options: WorldOptions = {}) {
  const w = await createRankingWorld(kit, options);
  worlds.push(w);
  const { entryIds, playersByEntry } = await addEntries(kit, w, 2);
  const built = await buildKnockout(kit, w, { slots: entryIds, codes: ['F'] });
  await playRounds(kit, built, () => 1);
  return { w, entryIds, playersByEntry, finalId: built.rounds[0]!.matchIds[0]! };
}

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { Queue, Worker } from 'bullmq';
import { QueueName } from '@kamito/shared';
import { API_ENV } from '../../src/common/config/app-config.module.js';
import type { ApiEnv } from '../../src/common/config/env-schema.js';
import { AuthTestKit } from '../support/auth-test-kit.js';
import { cleanupRankingWorld, createRankingWorld, type RankingWorld } from '../support/ranking-test-kit.js';

let kit: AuthTestKit;
let world: RankingWorld;
let worker: Worker;
let queue: Queue;
const originalPrefix = process.env.QUEUE_PREFIX;
const siteUrl = process.env.E2E_SITE_URL;
type Revalidate = (deps: { clientInternalUrl: string; secret: string; timeoutMs: number }, tags: unknown) => Promise<{ tags: number }>;
let refresh: Revalidate;
let refreshDeps: Parameters<Revalidate>[0];

beforeAll(async () => {
  if (!siteUrl) throw new Error('E2E_SITE_URL is required for the publication probe');
  // This worker must never consume pending jobs from the development application's queue.
  process.env.QUEUE_PREFIX = `${originalPrefix}:phase10-probe:${randomUUID()}`;
  kit = await AuthTestKit.start();
  const env = kit.app.get<ApiEnv>(API_ENV);
  const processor = path.resolve(import.meta.dirname, '../../../worker/src/processors/revalidate-processor.ts');
  ({ revalidateTags: refresh } = await import(/* @vite-ignore */ pathToFileURL(processor).href) as { revalidateTags: Revalidate });
  refreshDeps = { clientInternalUrl: siteUrl, secret: env.REVALIDATE_SECRET, timeoutMs: 5000 };
  queue = new Queue(QueueName.Revalidate, { prefix: env.QUEUE_PREFIX, connection: { url: env.REDIS_URL } });
  worker = new Worker(QueueName.Revalidate, (job) => refresh(refreshDeps, job.data.tags), {
    prefix: env.QUEUE_PREFIX, connection: { url: env.REDIS_URL }, concurrency: 1,
  });
  await worker.waitUntilReady();
}, 60_000);

afterAll(async () => {
  try {
    await worker?.close();
    // The random test prefix above is the sole namespace this cleanup can remove.
    await queue?.obliterate({ force: true });
    await queue?.close();
    if (kit && world) {
      await cleanupRankingWorld(kit, [world]);
      await refresh(refreshDeps, ['rankings', `ranking-RL-${world.tag}`, 'players']);
    }
  } finally {
    await kit?.close();
    if (originalPrefix === undefined) delete process.env.QUEUE_PREFIX;
    else process.env.QUEUE_PREFIX = originalPrefix;
  }
}, 60_000);

it('publishes through the real admin API and BullMQ worker then refreshes the warmed SSR ranking within ten seconds', async () => {
  const user = await kit.createUser({ role: 'ADMIN' });
  const cookie = await kit.signIn(user);
  await kit.write('post', '/api/v1/auth/step-up', cookie, { password: user.password }).expect(200);
  world = await createRankingWorld(kit);
  const player = await kit.prisma.player.create({ data: {
    code: `CACHE-${world.tag}`, slug: `cache-${world.tag}`, fullName: `Refresh ${world.tag}`,
    normalizedName: `refresh ${world.tag}`, gender: 'MALE', countryCode: 'VIE',
  } });
  world.playerIds.push(player.id);
  const snapshot = async (date: string, rank: number, points: number) => kit.prisma.rankingSnapshot.create({ data: {
    rankingListId: world.listId, asOfDate: new Date(date),
    rows: { create: { playerId: player.id, rank, points, resultsCounted: 0, breakdown: [] } },
  } });
  const previous = await snapshot('2099-06-01', 2, 137);
  await kit.prisma.rankingSnapshot.update({ where: { id: previous.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
  const next = await snapshot('2099-07-01', 1, 827);
  const url = `${siteUrl}/vi/rankings/RL-${world.tag}`;
  const before = await (await fetch(url)).text();
  expect(before).toContain('01/06/2099');
  expect(before).toContain('<strong>137</strong>');
  const started = performance.now();
  const published = await kit.write('post', `/api/v1/admin/ranking-snapshots/${next.id}/publish`, cookie).expect(200);
  expect(published.body.warnings).toBeUndefined();
  let html = '';
  while (performance.now() - started < 10_000) {
    html = await (await fetch(url)).text();
    if (html.includes('01/07/2099') && html.includes('<strong>827</strong>')) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const elapsedMs = Math.round(performance.now() - started);
  expect(html).toContain('01/07/2099');
  expect(html).toContain('<strong>827</strong>');
  expect(html).not.toContain('Cập nhật ngày 01/06/2099');
  expect(elapsedMs).toBeLessThanOrEqual(10_000);
  expect(await queue.getCompletedCount()).toBeGreaterThan(0);
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/public-ranking-publish-refresh.json', JSON.stringify({
    fromDate: '2099-06-01', toDate: '2099-07-01', fromPoints: 137, toPoints: 827,
    elapsedMs, limitMs: 10_000, completedRevalidationJobs: await queue.getCompletedCount(),
    workflow: 'real admin publish -> isolated BullMQ revalidation worker -> warmed SSR HTML',
  }, null, 2));
}, 60_000);

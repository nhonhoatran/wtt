import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { QueueName } from '@kamito/shared';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { API_ENV } from '../../src/common/config/app-config.module.js';
import type { ApiEnv } from '../../src/common/config/env-schema.js';
import { AuthTestKit } from '../support/auth-test-kit.js';
import { cleanupDraws } from '../support/draw-play-helpers.js';
import { API, cleanupFixtures, createPlayer, type Fixtures } from '../support/entries-fixtures.js';
import { straightWin, type ScoreFormat } from '../support/match-flow-helpers.js';
import { assertPublishingTestTarget as assertConfirmedTestTarget } from '../support/publishing-test-safety.js';

const REFRESH_LIMIT_MS = 5_000;
const originalPrefix = process.env.QUEUE_PREFIX;
type Refresh = (deps: { clientInternalUrl: string; secret: string; timeoutMs: number }, tags: unknown) => Promise<unknown>;
let kit: AuthTestKit | undefined;
let queue: Queue | undefined;
let worker: Worker | undefined;
let cacheRedis: Redis | undefined;
let fx: Fixtures | undefined;
let site: URL;
let apiBase: string;
const ownCacheKeys: string[] = [];

function loopbackUrl(value: string | undefined, label: string): URL {
  const url = new URL(value ?? '');
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${label} must be a loopback HTTP(S) origin without credentials`);
  }
  return url;
}

/** Probe the exact fixture response entry, without changing cache versions or application data. */
function responseKey(route: string, tags: string[]): string {
  const key = `${apiBase}:${route}:matchday:${tags.toSorted().join(',')}`;
  const redisKey = `${originalPrefix}:public:v1:response:${createHash('sha256').update(key).digest('hex')}`;
  ownCacheKeys.push(redisKey);
  return redisKey;
}

async function htmlAt(route: string, timeoutMs = REFRESH_LIMIT_MS): Promise<string> {
  const response = await fetch(new URL(route, site), { signal: AbortSignal.timeout(Math.max(1, Math.floor(timeoutMs))) });
  expect(response.status, `SSR ${route}`).toBe(200);
  return response.text();
}

/** Restrict score checks to the first real match cell, ahead of the next cell and RSC scripts. */
function bracketScores(html: string, matchNo: number): string[] {
  const marker = `data-match-number="${matchNo}"`;
  const start = html.indexOf(marker);
  expect(start, 'The warmed SSR bracket must include the fixture match').toBeGreaterThanOrEqual(0);
  const end = html.indexOf('data-match-number=', start + marker.length);
  const cell = html.slice(start, end === -1 ? undefined : end);
  return Array.from(cell.matchAll(/<span class="[^"]*score[^"]*">([^<]*)<\/span>/g), (match) => match[1]!);
}

async function idleQueue(): Promise<void> {
  const deadline = Date.now() + REFRESH_LIMIT_MS;
  while (Date.now() < deadline) {
    const counts = await queue!.getJobCounts('waiting', 'active', 'delayed', 'failed');
    expect(counts.failed ?? 0, 'No fixture revalidation job may fail').toBe(0);
    if (!(counts.waiting || counts.active || counts.delayed)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Fixture revalidation queue did not settle before warming SSR');
}

beforeAll(async () => {
  // This guard runs before constructing the app or any Redis/DB fixture.
  assertConfirmedTestTarget(process.env);
  site = loopbackUrl(process.env.E2E_SITE_URL, 'E2E_SITE_URL');
  apiBase = loopbackUrl(process.env.API_INTERNAL_URL, 'API_INTERNAL_URL').origin;
  process.env.QUEUE_PREFIX = `${originalPrefix}:vertical-slice:${randomUUID()}`;
  kit = await AuthTestKit.start();
  const env = kit.app.get<ApiEnv>(API_ENV);
  const processor = path.resolve(import.meta.dirname, '../../../worker/src/processors/revalidate-processor.ts');
  const { revalidateTags } = await import(/* @vite-ignore */ pathToFileURL(processor).href) as { revalidateTags: Refresh };
  queue = new Queue(QueueName.Revalidate, { prefix: env.QUEUE_PREFIX, connection: { url: env.REDIS_URL } });
  worker = new Worker(QueueName.Revalidate, (job) => revalidateTags({ clientInternalUrl: site.origin, secret: env.REVALIDATE_SECRET, timeoutMs: REFRESH_LIMIT_MS }, job.data.tags), {
    prefix: env.QUEUE_PREFIX, connection: { url: env.REDIS_URL }, concurrency: 1,
  });
  await worker.waitUntilReady();
  cacheRedis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, commandTimeout: REFRESH_LIMIT_MS });
}, 60_000);

afterAll(async () => {
  try {
    await worker?.close();
    // Result confirmation also enqueues ranking; Bull Board creates every known queue's metadata.
    // Remove all known queues only within this probe's UUID namespace.
    if (queue && kit) {
      const env = kit.app.get<ApiEnv>(API_ENV);
      for (const name of Object.values(QueueName)) {
        const owned = name === QueueName.Revalidate ? queue : new Queue(name, {
          prefix: env.QUEUE_PREFIX, connection: { url: env.REDIS_URL },
        });
        try {
          expect(await owned.getWorkers(), 'No other worker may own a fixture queue during cleanup').toHaveLength(0);
          await owned.obliterate({ force: true });
        }
        finally { await owned.close(); }
      }
    }
    if (kit && fx) {
      await cleanupDraws(kit, Object.values(fx.subEvents), fx.eventId);
      await cleanupFixtures(kit, fx);
    }
  } finally {
    try {
      // These keys belong to this fixture's unique event slug; shared tag versions remain intact.
      if (cacheRedis) { if (ownCacheKeys.length) await cacheRedis.del(...ownCacheKeys); await cacheRedis.quit(); }
    } finally {
      await kit?.close();
      if (originalPrefix === undefined) delete process.env.QUEUE_PREFIX;
      else process.env.QUEUE_PREFIX = originalPrefix;
    }
  }
}, 60_000);

it('creates and publishes a four-entry draw through admin APIs, then an operator result refreshes warmed SSR via BullMQ within five seconds', async () => {
  const app = kit!;
  const admin = await app.signIn(await app.createUser({ role: 'ADMIN' }));
  const operator = await app.signIn(await app.createUser({ role: 'RESULTS_OPERATOR' }));
  const tag = randomUUID().slice(0, 8);
  const eventType = await app.prisma.eventType.findFirstOrThrow({ where: { isActive: true }, select: { id: true } });
  const discipline = await app.prisma.discipline.findUniqueOrThrow({ where: { code: 'MS' }, select: { id: true } });
  const event = (await app.write('post', `${API}/events`, admin, {
    name: `Vertical slice ${tag}`, eventTypeId: eventType.id, startDate: '2099-05-01', endDate: '2099-05-02',
  }).expect(201)).body.data as { id: string; slug: string; name: string };
  fx = { eventId: event.id, subEvents: {}, playerIds: [], tag };
  const sub = (await app.write('post', `${API}/events/${event.id}/sub-events`, admin, {
    disciplineId: discipline.id, format: 'KNOCKOUT', hasQualifying: false,
  }).expect(201)).body.data as { id: string; code: string };
  fx.subEvents[sub.code] = sub.id;
  for (let index = 0; index < 4; index++) {
    const player = await createPlayer(app, admin, fx, { fullName: `Slice Player ${index + 1} ${tag}`, gender: 'MALE' });
    await app.write('post', `${API}/sub-events/${sub.id}/entries`, admin, { playerIds: [player.id] }).expect(201);
  }
  const draw = (await app.write('post', `${API}/sub-events/${sub.id}/draws`, admin, { kind: 'MAIN', seedCount: 0 }).expect(201)).body.data as { id: string; version: number };
  const published = await app.write('post', `${API}/draws/${draw.id}/publish`, admin, { expectedVersion: draw.version }).expect(200);
  expect(published.body.warnings ?? []).not.toContain('PUBLIC_REFRESH_DELAYED');
  await app.write('post', `${API}/events/${event.id}/publish`, admin).expect(200);
  await idleQueue();

  const listed = await app.get(`${API}/events/${event.id}/matches?pageSize=50`, operator).expect(200);
  const ready = (listed.body.data as { id: string; matchNo: number; ready: boolean }[]).filter((match) => match.ready).toSorted((a, b) => a.matchNo - b.matchNo);
  expect(ready).toHaveLength(2);
  const match = (await app.get(`${API}/matches/${ready[0]!.id}`, operator).expect(200)).body.data as { id: string; matchNo: number; version: number; format: ScoreFormat };
  const drawRoute = `/vi/events/${event.slug}/draws/${sub.code}`;
  const matchRoute = `/vi/events/${event.slug}/matches/${match.matchNo}`;
  const drawCache = responseKey(`/events/${event.slug}/draws/${sub.code}?kind=main`, [`draw-${event.slug}-${sub.code}`, 'players']);
  const matchCache = responseKey(`/events/${event.slug}/matches/${match.matchNo}`, [`match-${event.slug}-${match.matchNo}`, 'players']);
  responseKey(`/events/${event.slug}`, [`event-${event.slug}`, 'players']);
  for (let pass = 0; pass < 2; pass++) {
    const [drawHtml, matchHtml] = await Promise.all([htmlAt(drawRoute), htmlAt(matchRoute)]);
    expect(drawHtml).toContain(event.name);
    expect(bracketScores(drawHtml, match.matchNo)).toEqual(['', '']);
    expect(matchHtml).not.toContain('aria-label="Điểm từng ván"');
  }
  const cacheBeforeConfirm: { page: string; exists: number; pttlMs: number }[] = [];
  for (const [page, key] of [['draw', drawCache], ['match', matchCache]] as const) {
    const exists = await cacheRedis!.exists(key);
    const pttlMs = await cacheRedis!.pttl(key);
    expect(exists, 'SSR response must actually be stored in the shared cache').toBe(1);
    expect(pttlMs, 'Fallback TTL must outlive the refresh measurement').toBeGreaterThan(REFRESH_LIMIT_MS + 500);
    cacheBeforeConfirm.push({ page, exists, pttlMs });
  }

  const completedBefore = await queue!.getCompletedCount();
  const wins = Math.ceil(match.format.bestOf / 2);
  const started = performance.now();
  const confirmed = await app.write('post', `${API}/matches/${match.id}/confirm`, operator, {
    expectedVersion: match.version, resultType: 'NORMAL', games: straightWin(match.format, 1),
  }).expect(200);
  expect(confirmed.body.data).toMatchObject({ status: 'OFFICIAL', games1: wins, games2: 0 });
  expect(confirmed.body.warnings ?? []).not.toContain('PUBLIC_REFRESH_DELAYED');
  let refreshed = false;
  while (performance.now() - started < REFRESH_LIMIT_MS) {
    const remaining = REFRESH_LIMIT_MS - (performance.now() - started);
    const [drawHtml, matchHtml] = await Promise.all([htmlAt(drawRoute, remaining), htmlAt(matchRoute, remaining)]);
    refreshed = bracketScores(drawHtml, match.matchNo).join(':') === `${wins}:0`
      && matchHtml.includes('aria-label="Đã kết thúc"') && matchHtml.includes('aria-label="Điểm từng ván"');
    if (refreshed) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const elapsedMs = Math.round(performance.now() - started);
  expect(refreshed, 'Published SSR scores must change without a manual cache refresh').toBe(true);
  expect(elapsedMs).toBeLessThanOrEqual(REFRESH_LIMIT_MS);
  await idleQueue();
  const completedAfter = await queue!.getCompletedCount();
  expect(completedAfter).toBeGreaterThan(completedBefore);
  const output = path.resolve(process.env.E2E_VERTICAL_SLICE_PROBE_FILE ?? 'test-results/vertical-slice-refresh.json');
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({
    eventSlug: event.slug, subEvent: sub.code, entries: 4, matchNo: match.matchNo,
    result: `${wins}:0`, elapsedMs, limitMs: REFRESH_LIMIT_MS, cacheBeforeConfirm,
    completedRevalidationJobs: completedAfter - completedBefore,
    workflow: 'real admin create/entries/draw/publish APIs -> real operator confirm API -> isolated BullMQ production processor -> warmed SSR',
    limitation: 'Local API-driven vertical slice; not the eight-step admin browser workflow or staging M1 acceptance.',
  }, null, 2));
}, 120_000);

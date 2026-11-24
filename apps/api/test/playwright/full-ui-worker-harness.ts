import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Queue, Worker, UnrecoverableError, type Job } from 'bullmq';
import { createPrismaClient } from '@kamito/db';
import { QueueName, RANKING_RECOMPUTE_JOB, RANKING_SNAPSHOT_JOB, rankingRecomputeJob, revalidateTagsJobs } from '@kamito/shared';
import { createObjectStorage } from '@kamito/shared/object-storage';
import { loadImportProcessors } from '../support/import-test-kit.js';
import { loadRankingProcessors } from '../support/ranking-test-kit.js';
import { fullUiGuard, readWorld } from './full-ui-contract.js';

export async function fullUiWorkers(): Promise<void> {
  const guard = fullUiGuard(), world = await readWorld();
  const base = path.dirname(guard.worldFile);
  const readyFile = process.env.E2E_FULL_UI_WORKER_READY_FILE, stopFile = process.env.E2E_FULL_UI_WORKER_STOP_FILE;
  for (const file of [readyFile, stopFile]) if (!file || path.dirname(path.resolve(file)) !== base) throw new Error('Worker ready/stop files must share the owned world directory');
  if (existsSync(readyFile!) || existsSync(stopFile!)) throw new Error('Use fresh worker lifecycle files');
  const storagePath = path.resolve(process.env.UPLOAD_LOCAL_DIR ?? '');
  if (process.env.STORAGE_DRIVER !== 'local' || storagePath !== path.join(base, 'uploads')) throw new Error('Worker storage must be the exact owned uploads directory');
  const importProcessors = await loadImportProcessors(), ranking = await loadRankingProcessors();
  const module = path.resolve(import.meta.dirname, '../../../worker/src/processors/revalidate-processor.ts');
  const { revalidateTags } = await import(/* @vite-ignore */ pathToFileURL(module).href) as { revalidateTags: (deps: { clientInternalUrl: string; secret: string; timeoutMs: number }, tags: unknown) => Promise<unknown> };
  const failures: { queue: string; jobId?: string; message: string }[] = [];
  const workers: Worker[] = [];
  const limits = { IMPORT_MAX_FILE_BYTES: Number(process.env.IMPORT_MAX_FILE_BYTES), IMPORT_MAX_UNZIPPED_BYTES: Number(process.env.IMPORT_MAX_UNZIPPED_BYTES), IMPORT_MAX_ROWS: Number(process.env.IMPORT_MAX_ROWS) };
  const timeout = Number(process.env.E2E_FULL_UI_WORKER_TIMEOUT_MS ?? 1800000);
  if ([...Object.values(limits), timeout].some((value) => !Number.isSafeInteger(value) || value <= 0)) throw new Error('Worker ceilings and lifetime must be positive integers');
  const prisma = createPrismaClient({ connectionString: process.env.DATABASE_URL! });
  const storage = createObjectStorage({ STORAGE_DRIVER: 'local', UPLOAD_LOCAL_DIR: storagePath, S3_FORCE_PATH_STYLE: true });
  const options = { prefix: guard.prefix, connection: { url: process.env.REDIS_URL! } };
  const queues = Object.fromEntries([QueueName.Import, QueueName.Ranking, QueueName.Revalidate].map((name) => [name, new Queue(name, options)]));
  for (const [name, queue] of Object.entries(queues)) queue.on('error', (error) => { failures.push({ queue: name, message: error.message }); });
  const enqueueRevalidate = async (tags: string[]) => { for (const job of revalidateTagsJobs(tags)) await queues[QueueName.Revalidate]!.add(job.name, job.data, job.opts); };
  const enqueueRecompute = async (subEventId: string) => { const job = rankingRecomputeJob(subEventId); await queues[QueueName.Ranking]!.add(job.name, job.data, job.opts); };
  const ownEvent = async (eventId: string) => { const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { eventTypeId: true, name: true } }); if (event.eventTypeId !== world.catalog.eventTypeId || !event.name.includes(world.tag)) throw new UnrecoverableError('Refusing a foreign event job'); };
  try {
    workers.push(new Worker(QueueName.Import, async (job: Job<{ importJobId?: string; attemptNo?: number }>) => {
      const importId = job.data.importJobId;
      if (!importId || !['validate-import', 'commit-import'].includes(job.name)) throw new UnrecoverableError('Unexpected full UI import job');
      const row = await prisma.importJob.findUniqueOrThrow({ where: { id: importId }, select: { eventId: true, createdById: true } });
      if (!world.owned.userIds.includes(row.createdById)) throw new UnrecoverableError('Refusing a foreign import actor'); await ownEvent(row.eventId);
      const deps = { prisma, storage, env: limits, enqueueRevalidate };
      return job.name === 'validate-import' ? importProcessors.validateImport(deps, importId) : importProcessors.commitImport(deps, importId, job.data.attemptNo);
    }, { ...options, concurrency: 1 }));
    workers.push(new Worker(QueueName.Ranking, async (job: Job<{ subEventId?: string; listId?: string; asOf?: string }>) => {
      const deps = { prisma, enqueueRecompute };
      if (job.name === RANKING_RECOMPUTE_JOB && job.data.subEventId) { const sub = await prisma.subEvent.findUniqueOrThrow({ where: { id: job.data.subEventId }, select: { eventId: true } }); await ownEvent(sub.eventId); return ranking.recomputeSubEvent(deps, job.data.subEventId); }
      if (job.name === RANKING_SNAPSHOT_JOB && job.data.listId && job.data.asOf && world.owned.catalogIds.rankingListIds.includes(job.data.listId)) return ranking.buildSnapshot(deps, { listId: job.data.listId, asOf: job.data.asOf });
      throw new UnrecoverableError('Unexpected full UI ranking job');
    }, { ...options, concurrency: 1 }));
    workers.push(new Worker(QueueName.Revalidate, (job) => revalidateTags({ clientInternalUrl: world.siteOrigin, secret: process.env.REVALIDATE_SECRET!, timeoutMs: 5000 }, job.data.tags), { ...options, concurrency: 1 }));
    for (const worker of workers) {
      worker.on('failed', (job, error) => { failures.push({ queue: worker.name, jobId: job?.id, message: error.message }); });
      worker.on('error', (error) => { failures.push({ queue: worker.name, message: error.message }); });
    }
    await Promise.all(workers.map((worker) => worker.waitUntilReady()));
    await mkdir(base, { recursive: true });
    await writeFile(readyFile!, JSON.stringify({ runId: world.runId, pid: process.pid, prefix: guard.prefix, ready: true, schedulers: false }));
    const started = Date.now();
    while (!existsSync(stopFile!)) { if (Date.now() - started > timeout) throw new Error('Full UI worker lifetime exceeded'); await new Promise((resolve) => setTimeout(resolve, 100)); }
  } finally {
    const closed = await Promise.allSettled(workers.map((worker) => worker.close()));
    const stopped = closed.every((item) => item.status === 'fulfilled');
    for (const item of closed) if (item.status === 'rejected') failures.push({ queue: 'shutdown', message: String(item.reason) });
    try {
      const counts = Object.fromEntries(await Promise.all(Object.entries(queues).map(async ([name, queue]) => [name, await queue.getJobCounts('completed', 'failed', 'waiting', 'active', 'delayed')])));
      await writeFile(path.join(base, 'full-ui-worker-stopped.json'), JSON.stringify({ runId: world.runId, prefix: guard.prefix, stopped, failures, counts }, null, 2));
    } finally { await Promise.allSettled(Object.values(queues).map((queue) => queue.close())); await prisma.$disconnect(); }
  }
  if (failures.length) throw new Error(`Full UI worker recorded ${failures.length} failures; inspect its owned report`);
}

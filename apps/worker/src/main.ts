import { Redis } from 'ioredis';
import { pino } from 'pino';
import { safeErrorSummary } from '@kamito/shared';
import { startImportWorker } from './import-worker.js';
import { startMediaWorker } from './media-worker.js';
import { startRankingWorker } from './ranking-worker.js';
import { startRevalidateWorker } from './revalidate-worker.js';
import { startPublishingWorker } from './publishing-worker.js';
import { checkRedisEvictionPolicy } from './redis-eviction-guard.js';
import { loadWorkerEnv } from './worker-env.js';
import { startWorkerHealthServer, type WorkerHealthState } from './worker-health-server.js';

// Processor rule: job payloads carry ids only; processors reload records from the DB
// and check their state before acting.

async function main(): Promise<void> {
  const env = loadWorkerEnv();
  const logger = pino({ level: env.LOG_LEVEL, base: { service: 'worker', env: env.APP_ENV }, serializers: { err: safeErrorSummary, error: safeErrorSummary } });

  const verdict = await checkRedisEvictionPolicy(env);
  let health: WorkerHealthState = { status: 'ok' };
  if (verdict.status === 'fatal') {
    logger.fatal({ status: verdict.status }, 'Redis eviction check failed; refusing to run');
    process.exit(1);
  } else if (verdict.status === 'overridden') {
    logger.warn({ status: verdict.status }, 'Redis eviction check override is active');
  } else if (verdict.status === 'degraded') {
    logger.error({ status: verdict.status }, 'Redis eviction check not ready');
    health = { status: 'degraded', detail: verdict.message };
  }

  // Shared connection for BullMQ workers; BullMQ requires maxRetriesPerRequest: null.
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  redis.on('error', (error) => logger.error({ err: safeErrorSummary(error) }, 'redis connection error'));

  const stopMedia = await startMediaWorker(env, redis, logger);
  const stopImport = await startImportWorker(env, redis, logger);
  const stopRevalidate = await startRevalidateWorker(env, redis, logger);
  const stopRanking = await startRankingWorker(env, redis, logger);
  const stopPublishing = await startPublishingWorker(env, redis, logger);

  const server = await startWorkerHealthServer(env.WORKER_HEALTH_PORT, () => health);
  logger.info({ queuePrefix: env.QUEUE_PREFIX, healthPort: env.WORKER_HEALTH_PORT }, 'worker started');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'worker shutting down');
    server.close();
    await stopMedia();
    await stopImport();
    await stopRevalidate();
    await stopRanking();
    await stopPublishing();
    await redis.quit();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ msg: 'worker startup failed', err: safeErrorSummary(error) }));
  process.exit(1);
});

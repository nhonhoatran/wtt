import { Redis } from 'ioredis';
import { pino } from 'pino';
import { startImportWorker } from './import-worker.js';
import { startMediaWorker } from './media-worker.js';
import { checkRedisEvictionPolicy } from './redis-eviction-guard.js';
import { loadWorkerEnv } from './worker-env.js';
import { startWorkerHealthServer, type WorkerHealthState } from './worker-health-server.js';

// Processor rule: job payloads carry ids only; processors reload records from the DB
// and check their state before acting.

async function main(): Promise<void> {
  const env = loadWorkerEnv();
  const logger = pino({ level: env.LOG_LEVEL, base: { service: 'worker', env: env.APP_ENV } });

  const verdict = await checkRedisEvictionPolicy(env);
  let health: WorkerHealthState = { status: 'ok' };
  if (verdict.status === 'fatal') {
    logger.fatal(`${verdict.message}; refusing to run`);
    process.exit(1);
  } else if (verdict.status === 'overridden') {
    logger.warn(`${verdict.message} (override set)`);
  } else if (verdict.status === 'degraded') {
    logger.error(verdict.message);
    health = { status: 'degraded', detail: verdict.message };
  }

  // Shared connection for BullMQ workers; BullMQ requires maxRetriesPerRequest: null.
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  redis.on('error', (error) => logger.error({ err: error.message }, 'redis connection error'));

  const stopMedia = await startMediaWorker(env, redis, logger);
  const stopImport = await startImportWorker(env, redis, logger);

  const server = await startWorkerHealthServer(env.WORKER_HEALTH_PORT, () => health);
  logger.info({ queuePrefix: env.QUEUE_PREFIX, healthPort: env.WORKER_HEALTH_PORT }, 'worker started');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'worker shutting down');
    server.close();
    await stopMedia();
    await stopImport();
    await redis.quit();
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

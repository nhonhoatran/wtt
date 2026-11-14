import { Inject, Injectable, Logger, NotFoundException, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { QueueName, rankingRecomputeJob, rankingSnapshotJob } from '@kamito/shared';
import { Queue } from 'bullmq';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';

export const RANKING_RECOMPUTE_DELAYED = 'RANKING_RECOMPUTE_DELAYED';
export const RANKING_SNAPSHOT_REBUILD_SUGGESTED = 'RANKING_SNAPSHOT_REBUILD_SUGGESTED';

/** Fixed: internal reliability knob. Fail fast when Redis is down: callers have already committed and the dirty sweep is the safety net. */
const ENQUEUE_TIMEOUT_MS = 2_000;
const RANKING_JOB_ID = /^rank-[A-Za-z0-9-]{1,120}$/;

export interface RankingJobStatus {
  id: string;
  name: string;
  state: string;
  attemptsMade: number;
  failedReason: string | null;
  result: unknown;
}

const queueUnavailable = () =>
  new ServiceUnavailableException({ code: 'QUEUE_UNAVAILABLE', message: 'Hàng đợi xếp hạng chưa sẵn sàng, thử lại sau' });

/** Producer of the `ranking` queue. Job options come from `@kamito/shared` so every producer matches the worker. */
@Injectable()
export class RankingEnqueueService implements OnModuleDestroy {
  private readonly logger = new Logger(RankingEnqueueService.name);
  private readonly queue: Queue;

  constructor(@Inject(API_ENV) env: ApiEnv) {
    this.queue = new Queue(QueueName.Ranking, {
      connection: { url: env.REDIS_URL, enableOfflineQueue: false, maxRetriesPerRequest: 1 },
      prefix: env.QUEUE_PREFIX,
    });
    this.queue.on('error', (error) => this.logger.warn(`ranking queue: ${error.message}`));
  }

  /** Never throws: returns the warnings to attach to the (already committed) response. */
  async enqueueRecompute(subEventIds: string[]): Promise<string[]> {
    for (const subEventId of new Set(subEventIds)) {
      try {
        const job = rankingRecomputeJob(subEventId);
        await withTimeout(this.queue.add(job.name, job.data, job.opts), ENQUEUE_TIMEOUT_MS);
      } catch (error) {
        this.logger.warn(`ranking recompute enqueue failed: ${(error as Error).message}`);
        return [RANKING_RECOMPUTE_DELAYED];
      }
    }
    return [];
  }

  async enqueueSnapshot(listId: string, asOf: string): Promise<string> {
    const job = rankingSnapshotJob(listId, asOf);
    try {
      await withTimeout(this.queue.add(job.name, job.data, job.opts), ENQUEUE_TIMEOUT_MS);
    } catch (error) {
      this.logger.warn(`ranking snapshot enqueue failed: ${(error as Error).message}`);
      throw queueUnavailable();
    }
    return job.opts.jobId;
  }

  async jobStatus(jobId: string): Promise<RankingJobStatus> {
    const notFound = () => new NotFoundException({ code: 'RANKING_JOB_NOT_FOUND', message: 'Không tìm thấy tác vụ' });
    if (!RANKING_JOB_ID.test(jobId)) throw notFound();
    let job;
    try {
      job = await withTimeout(this.queue.getJob(jobId), ENQUEUE_TIMEOUT_MS);
    } catch (error) {
      this.logger.warn(`ranking job lookup failed: ${(error as Error).message}`);
      throw queueUnavailable();
    }
    if (!job) throw notFound();
    return {
      id: jobId,
      name: job.name,
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason || null,
      result: job.returnvalue ?? null,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

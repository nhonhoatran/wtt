import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { isValidCacheTag, QueueName, REVALIDATE_TAGS_JOB } from '@kamito/shared';
import { Queue } from 'bullmq';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';

export const PUBLIC_REFRESH_DELAYED = 'PUBLIC_REFRESH_DELAYED';

const ATTEMPTS = 5;
const BACKOFF_MS = 2_000;
const COMPLETED_KEPT = 100;
const FAILED_KEPT = 500;
/** Fail fast when Redis is down: the caller has already committed and only needs to report a warning. */
const ENQUEUE_TIMEOUT_MS = 2_000;

/**
 * Producer of the revalidate queue. A unique job id per call: a fixed id would let BullMQ drop a newer
 * job while an older one with the same id is retained. Revalidation is idempotent, so duplicates are harmless.
 */
@Injectable()
export class RevalidationEnqueueService implements OnModuleDestroy {
  private readonly logger = new Logger(RevalidationEnqueueService.name);
  private readonly queue: Queue;

  constructor(@Inject(API_ENV) env: ApiEnv) {
    this.queue = new Queue(QueueName.Revalidate, {
      connection: { url: env.REDIS_URL, enableOfflineQueue: false, maxRetriesPerRequest: 1 },
      prefix: env.QUEUE_PREFIX,
    });
    this.queue.on('error', (error) => this.logger.warn(`revalidate queue: ${error.message}`));
  }

  /** Never throws: returns the warnings to attach to the (already committed) response. */
  async enqueue(buildTags: () => string[]): Promise<string[]> {
    try {
      const all = [...new Set(buildTags())];
      const tags = all.filter(isValidCacheTag);
      const dropped = all.length - tags.length;
      if (dropped) this.logger.warn(`dropped ${dropped} invalid cache tag(s)`);
      if (!tags.length) return dropped ? [PUBLIC_REFRESH_DELAYED] : [];
      await withTimeout(
        this.queue.add(
          REVALIDATE_TAGS_JOB,
          { tags },
          {
            jobId: `reval-${randomUUID()}`,
            attempts: ATTEMPTS,
            backoff: { type: 'exponential', delay: BACKOFF_MS },
            removeOnComplete: { count: COMPLETED_KEPT },
            removeOnFail: { count: FAILED_KEPT },
          },
        ),
        ENQUEUE_TIMEOUT_MS,
      );
      return dropped ? [PUBLIC_REFRESH_DELAYED] : [];
    } catch (error) {
      this.logger.warn(`revalidate enqueue failed: ${(error as Error).message}`);
      return [PUBLIC_REFRESH_DELAYED];
    }
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

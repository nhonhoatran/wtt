import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { QueueName } from '@kamito/shared';
import { MEDIA_PROCESS_JOB } from '@kamito/shared/media';
import { Queue } from 'bullmq';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';

/** Failed jobs stay a week so an operator can inspect them in Bull Board. */
const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;
/** Keeps the completed list bounded; completed jobs are only useful for recent debugging. */
const COMPLETED_JOBS_KEPT = 1000;
/** Three tries ride out a brief storage or database blip; a bad image fails fast anyway. */
const MAX_ATTEMPTS = 3;
/** First retry after 5 s, then 10 s: long enough for a storage hiccup to clear. */
const RETRY_BASE_DELAY_MS = 5000;

@Injectable()
export class MediaQueue implements OnModuleDestroy {
  private readonly queue: Queue;

  constructor(@Inject(API_ENV) env: ApiEnv) {
    this.queue = new Queue(QueueName.Media, { connection: { url: env.REDIS_URL }, prefix: env.QUEUE_PREFIX });
  }

  async enqueueProcessing(mediaId: string): Promise<void> {
    const jobId = `media-${mediaId}`;
    // A fixed jobId makes BullMQ ignore add() while an old job with that id still exists (e.g. an
    // earlier attempt whose enqueue was reverted); drop the stale one first. No-op for an active job.
    await this.queue.remove(jobId);
    await this.queue.add(
      MEDIA_PROCESS_JOB,
      { mediaId },
      {
        jobId,
        attempts: MAX_ATTEMPTS,
        backoff: { type: 'exponential', delay: RETRY_BASE_DELAY_MS },
        removeOnComplete: { count: COMPLETED_JOBS_KEPT },
        removeOnFail: { age: SEVEN_DAYS_SECONDS },
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}

import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PUBLISH_ARTICLE_JOB, QueueName, safeErrorSummary, withTimeout } from '@kamito/shared';
import { Queue } from 'bullmq';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';

export const ARTICLE_PUBLISHING_DELAYED = 'ARTICLE_PUBLISHING_DELAYED';
// Internal reliability limit: saved content must return promptly while Redis is unavailable.
const ENQUEUE_TIMEOUT_MS = 2_000;

@Injectable()
export class PublishingEnqueueService implements OnModuleDestroy {
  private readonly logger = new Logger(PublishingEnqueueService.name);
  private readonly queue: Queue;

  constructor(@Inject(API_ENV) env: ApiEnv) {
    this.queue = new Queue(QueueName.Publishing, { connection: { url: env.REDIS_URL, enableOfflineQueue: false, maxRetriesPerRequest: 1 }, prefix: env.QUEUE_PREFIX });
    this.queue.on('error', (error) => this.logger.warn({ msg: 'publishing queue error', err: safeErrorSummary(error) }));
  }

  async scheduleArticle(articleId: string, publishAt: Date | null): Promise<string[]> {
    if (!publishAt || publishAt <= new Date()) return [];
    const epoch = publishAt.getTime();
    return this.enqueueSafely('schedule', articleId, () => this.queue.add(PUBLISH_ARTICLE_JOB, { articleId }, {
        jobId: `art-${articleId}-${epoch}`,
        delay: Math.max(0, epoch - Date.now()),
        attempts: 5,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      }),
    );
  }

  async cancelArticleSchedule(articleId: string, publishAt: Date | null): Promise<string[]> {
    if (!publishAt) return [];
    return this.enqueueSafely('cancel', articleId, () => this.queue.remove(`art-${articleId}-${publishAt.getTime()}`));
  }

  /** The database is already committed; the periodic sweep recovers missing jobs and ignores stale ones. */
  private async enqueueSafely(operation: string, articleId: string, run: () => Promise<unknown>): Promise<string[]> {
    try {
      await withTimeout(run(), ENQUEUE_TIMEOUT_MS);
      return [];
    } catch (error) {
      this.logger.warn({ msg: 'article publishing enqueue failed', operation, articleId, err: safeErrorSummary(error) });
      return [ARTICLE_PUBLISHING_DELAYED];
    }
  }

  async onModuleDestroy(): Promise<void> { await this.queue.close(); }
}

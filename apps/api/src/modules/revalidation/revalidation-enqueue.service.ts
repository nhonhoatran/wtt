import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { isValidCacheTag, QueueName, REVALIDATE_ENQUEUE_TIMEOUT_MS, revalidateTagsJobs, withTimeout } from '@kamito/shared';
import { Queue } from 'bullmq';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';

export const PUBLIC_REFRESH_DELAYED = 'PUBLIC_REFRESH_DELAYED';

/** Producer of the revalidate queue; job options come from `@kamito/shared` so the import worker enqueues identically. */
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

  /** Never throws, even when loading the tag context fails: returns the warnings to attach to the (already committed) response. */
  async enqueue(buildTags: () => string[] | Promise<string[]>): Promise<string[]> {
    try {
      const all = [...new Set(await buildTags())];
      const tags = all.filter(isValidCacheTag);
      const dropped = all.length - tags.length;
      if (dropped) this.logger.warn(`dropped ${dropped} invalid cache tag(s)`);
      if (!tags.length) return dropped ? [PUBLIC_REFRESH_DELAYED] : [];
      const jobs = revalidateTagsJobs(tags);
      await withTimeout(Promise.all(jobs.map((job) => this.queue.add(job.name, job.data, job.opts))), REVALIDATE_ENQUEUE_TIMEOUT_MS);
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

import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { QueueName } from '@kamito/shared';
import { Queue } from 'bullmq';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';

export const VALIDATE_IMPORT_JOB = 'validate-import';
export const COMMIT_IMPORT_JOB = 'commit-import';

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;
const COMPLETED_JOBS_KEPT = 1000;
/** One retry rides out a storage or database blip; a bad file fails permanently on the first try. */
const VALIDATE_ATTEMPTS = 2;
const VALIDATE_BACKOFF_MS = 10_000;

/** Producer side of the import queue; payloads carry the job id only. */
@Injectable()
export class ImportQueue implements OnModuleDestroy {
  private readonly queue: Queue;

  constructor(@Inject(API_ENV) env: ApiEnv) {
    this.queue = new Queue(QueueName.Import, { connection: { url: env.REDIS_URL }, prefix: env.QUEUE_PREFIX });
  }

  async enqueueValidate(importJobId: string, attemptNo: number): Promise<void> {
    await this.queue.add(
      VALIDATE_IMPORT_JOB,
      { importJobId },
      {
        jobId: `imp-${importJobId}-validate-${attemptNo}`,
        attempts: VALIDATE_ATTEMPTS,
        backoff: { type: 'fixed', delay: VALIDATE_BACKOFF_MS },
        removeOnComplete: { count: COMPLETED_JOBS_KEPT },
        removeOnFail: { age: SEVEN_DAYS_SECONDS },
      },
    );
  }

  async enqueueCommit(importJobId: string, attemptNo: number): Promise<void> {
    await this.queue.add(
      COMMIT_IMPORT_JOB,
      { importJobId, attemptNo },
      {
        jobId: `imp-${importJobId}-commit-${attemptNo}`,
        attempts: 1,
        removeOnComplete: { count: COMPLETED_JOBS_KEPT },
        removeOnFail: { age: SEVEN_DAYS_SECONDS },
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}

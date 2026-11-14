import { REVALIDATE_MAX_TAGS } from './public-api.js';
import { REVALIDATE_TAGS_JOB } from './public-cache-tags.js';

const ATTEMPTS = 5;
const BACKOFF_MS = 2_000;
const COMPLETED_KEPT = 100;
const FAILED_KEPT = 500;

export interface RevalidateJobSpec {
  name: string;
  data: { tags: string[] };
  opts: {
    jobId: string;
    attempts: number;
    backoff: { type: 'exponential'; delay: number };
    removeOnComplete: { count: number };
    removeOnFail: { count: number };
  };
}

/**
 * A unique job id per call: a fixed id would let BullMQ drop a newer job while an older one with the
 * same id is retained. Revalidation is idempotent, so duplicates are harmless.
 */
export const revalidateTagsJob = (tags: string[]): RevalidateJobSpec => ({
  name: REVALIDATE_TAGS_JOB,
  data: { tags },
  opts: {
    jobId: `reval-${globalThis.crypto.randomUUID()}`,
    attempts: ATTEMPTS,
    backoff: { type: 'exponential', delay: BACKOFF_MS },
    removeOnComplete: { count: COMPLETED_KEPT },
    removeOnFail: { count: FAILED_KEPT },
  },
});

/** The client route rejects more than REVALIDATE_MAX_TAGS tags, and that failure is permanent, so large sets are split. */
export const revalidateTagsJobs = (tags: string[]): RevalidateJobSpec[] => {
  const unique = [...new Set(tags)];
  const jobs: RevalidateJobSpec[] = [];
  for (let start = 0; start < unique.length; start += REVALIDATE_MAX_TAGS) jobs.push(revalidateTagsJob(unique.slice(start, start + REVALIDATE_MAX_TAGS)));
  return jobs;
};

import { Queue, type Job } from 'bullmq';

/** Newest jobs read per state. The local queue can hold thousands of undrained jobs; a full scan times out. */
export const PROBE_WINDOW = 300;
const STATES = ['waiting', 'delayed', 'active', 'completed', 'failed'] as const;

export const openRevalidateQueue = () => new Queue('revalidate', { connection: { url: process.env.REDIS_URL }, prefix: process.env.QUEUE_PREFIX });

/** Newest-first window of every state, without job logs. */
export const recentJobs = (queue: Queue): Promise<Job[]> => queue.getJobs([...STATES], 0, PROBE_WINDOW - 1, false);

const isOwn = (job: Job, token: string) => (job.data.tags as string[]).some((tag) => tag.toLowerCase().includes(token.toLowerCase()));

/** Tags of the jobs queued at or after `since`; with `token`, only jobs that carry this run's unique token. */
export async function tagsSince(queue: Queue, since: number, token?: string): Promise<Set<string>> {
  const jobs = (await recentJobs(queue)).filter((job) => job.timestamp >= since && (!token || isOwn(job, token)));
  return new Set(jobs.flatMap((job) => job.data.tags as string[]));
}

/** Removes the jobs this run created (queued at or after `since`, carrying `token`) so the backlog does not grow. */
export async function removeOwn(queue: Queue, since: number, token: string): Promise<void> {
  const jobs = (await recentJobs(queue)).filter((job) => job.timestamp >= since && isOwn(job, token));
  await Promise.all(jobs.map((job) => job.remove().catch(() => undefined)));
}

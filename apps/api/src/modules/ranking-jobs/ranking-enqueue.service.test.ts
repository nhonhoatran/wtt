import { describe, expect, it } from 'vitest';
import { RankingEnqueueService } from './ranking-enqueue.service.js';

const JOB_ID = 'rank-snap-00000000-0000-4000-8000-000000000000';
const RESULT = { outcome: 'built', snapshotId: '11111111-1111-4111-8111-111111111111', rows: 40 };

/** A queue whose job finishes right after the first Redis read, whichever read that is. */
function queueFinishingBetweenReads() {
  let finished = false;
  const read = <T>(before: T, after: T): Promise<T> => {
    const value = finished ? after : before;
    finished = true;
    return Promise.resolve(value);
  };
  const state = () => read('active', 'completed');
  const job = (attemptsMade: number, returnvalue: unknown) => ({ name: 'build-snapshot', attemptsMade, failedReason: undefined, returnvalue, getState: state });
  return { getJobState: state, getJob: () => read(job(0, null), job(1, RESULT)), close: () => Promise.resolve() };
}

describe('RankingEnqueueService.jobStatus', () => {
  it('never reports a finished job without its result when the job finishes between the two reads', async () => {
    const service = new RankingEnqueueService({ REDIS_URL: 'redis://127.0.0.1:1', QUEUE_PREFIX: 'ranking-status-test' } as never);
    const holder = service as unknown as { queue: { close(): Promise<void> } };
    const real = holder.queue;
    holder.queue = queueFinishingBetweenReads();
    try {
      const status = await service.jobStatus(JOB_ID);
      expect(status.state === 'completed' && status.result === null, JSON.stringify(status)).toBe(false);
      expect(status.result).toEqual(RESULT);
    } finally {
      await real.close();
    }
  });
});

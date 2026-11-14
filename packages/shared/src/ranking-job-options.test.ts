import { describe, expect, it } from 'vitest';
import { RANKING_RECOMPUTE_JOB, RANKING_SNAPSHOT_JOB } from './queue-names.js';
import { rankingRecomputeJob, rankingSnapshotJob } from './ranking-job-options.js';

describe('ranking job specs', () => {
  it('gives every recompute enqueue its own job id so a later change is never dropped', () => {
    const a = rankingRecomputeJob('se-1');
    const b = rankingRecomputeJob('se-1');
    expect(a.opts.jobId).toMatch(/^rank-se-se-1-[0-9a-f-]{36}$/);
    expect(a.opts.jobId).not.toBe(b.opts.jobId);
    expect(a).toMatchObject({ name: RANKING_RECOMPUTE_JOB, data: { subEventId: 'se-1' }, opts: { attempts: 5, backoff: { type: 'exponential', delay: 5000 } } });
  });

  it('snapshot jobs carry ids and date only, with 3 attempts', () => {
    const job = rankingSnapshotJob('list-1', '2099-06-01');
    expect(job).toMatchObject({ name: RANKING_SNAPSHOT_JOB, data: { listId: 'list-1', asOf: '2099-06-01' }, opts: { attempts: 3 } });
    expect(job.opts.jobId).toMatch(/^rank-snap-/);
  });
});

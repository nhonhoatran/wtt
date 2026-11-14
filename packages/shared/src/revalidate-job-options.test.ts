import { describe, expect, it } from 'vitest';
import { REVALIDATE_TAGS_JOB } from './public-cache-tags.js';
import { REVALIDATE_MAX_TAGS } from './public-api.js';
import { revalidateTagsJob, revalidateTagsJobs } from './revalidate-job-options.js';

describe('revalidateTagsJob', () => {
  it('carries the tags with the queue conventions and a unique id per call', () => {
    const a = revalidateTagsJob(['events']);
    const b = revalidateTagsJob(['events']);
    expect(a).toMatchObject({ name: REVALIDATE_TAGS_JOB, data: { tags: ['events'] }, opts: { attempts: 5, backoff: { type: 'exponential', delay: 2000 } } });
    expect(a.opts.jobId).toMatch(/^reval-[0-9a-f-]{36}$/);
    expect(a.opts.jobId).not.toBe(b.opts.jobId);
  });
});

describe('revalidateTagsJobs', () => {
  it('dedupes and splits a large tag set into jobs the client route accepts', () => {
    const tags = Array.from({ length: REVALIDATE_MAX_TAGS + 5 }, (_, i) => `player-p${i}`);
    const jobs = revalidateTagsJobs([...tags, 'player-p0']);
    expect(jobs.map((job) => job.data.tags.length)).toEqual([REVALIDATE_MAX_TAGS, 5]);
    expect(new Set(jobs.map((job) => job.opts.jobId)).size).toBe(2);
  });

  it('returns no job for an empty set', () => {
    expect(revalidateTagsJobs([])).toEqual([]);
  });
});

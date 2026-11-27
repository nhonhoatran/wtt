import assert from 'node:assert/strict';
import { test } from 'node:test';
import { snapshotJobResult, snapshotJobsSucceeded } from '../src/pages/ranking/snapshot-job-state.ts';

const job = { listId: 'singles', listCode: 'MS', jobId: 'rank-snap-1' };
const completed = (snapshotId) => ({ data: { state: 'completed', failedReason: null, result: { snapshotId } } });

test('only completed jobs with their own snapshot id confirm success', () => {
  assert.deepEqual(snapshotJobResult(job, completed('draft-1')), {
    listId: 'singles', outcome: 'succeeded', snapshotId: 'draft-1',
  });
  assert.equal(snapshotJobsSucceeded([snapshotJobResult(job, completed('draft-1'))]), true);
});

test('waiting and active jobs do not report an outcome even if their result was read after completion', () => {
  assert.equal(snapshotJobResult(job, {}), null);
  for (const state of ['waiting', 'delayed', 'active']) {
    assert.equal(snapshotJobResult(job, { data: { state, failedReason: null, result: { snapshotId: 'draft-1' } } }), null);
  }
});

test('worker failure remains failure even when a stale result is present', () => {
  const result = snapshotJobResult(job, { data: { state: 'failed', failedReason: 'worker failed', result: { snapshotId: 'old' } } });
  assert.deepEqual(result, { listId: 'singles', outcome: 'failed', snapshotId: null });
  assert.equal(snapshotJobsSucceeded([result]), false);
});

test('404, server and network failures are unknown outcomes and never dismiss feedback', () => {
  for (const error of [Object.assign(new Error('not found'), { statusCode: 404 }), Object.assign(new Error('server'), { statusCode: 500 }), Object.assign(new Error('unavailable'), { statusCode: 503 }), new TypeError('network')]) {
    const result = snapshotJobResult(job, { error });
    assert.deepEqual(result, { listId: 'singles', outcome: 'unavailable', snapshotId: null });
    assert.equal(snapshotJobsSucceeded([result]), false);
  }
});

test('a failed refetch does not present stale cached data as a successful lookup', () => {
  assert.equal(snapshotJobResult(job, { ...completed('draft-1'), error: new Error('network') }).outcome, 'unavailable');
});

test('completed jobs without a usable snapshot id stay unknown instead of succeeding with null', () => {
  for (const snapshotId of [undefined, null, '', ' ', 123]) {
    const result = snapshotJobResult(job, completed(snapshotId));
    assert.deepEqual(result, { listId: 'singles', outcome: 'unavailable', snapshotId: null });
  }
  assert.equal(snapshotJobResult(job, { data: { state: 'completed', failedReason: null, result: null } }).outcome, 'unavailable');
});

test('a successful retry resolves only its own job and mixed batches keep error feedback', () => {
  const other = { listId: 'doubles', listCode: 'WD', jobId: 'rank-snap-2' };
  const results = [snapshotJobResult(job, completed('draft-1')), snapshotJobResult(other, { error: new Error('timeout') })];
  assert.equal(snapshotJobsSucceeded(results), false);
  results[1] = snapshotJobResult(other, completed('draft-2'));
  assert.equal(snapshotJobsSucceeded(results), true);
  assert.equal(results[1].snapshotId, 'draft-2');
  assert.equal(snapshotJobsSucceeded([]), false);
});

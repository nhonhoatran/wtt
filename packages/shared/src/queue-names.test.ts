import { describe, expect, it } from 'vitest';
import { QueueName, RANKING_RECOMPUTE_JOB, RANKING_SNAPSHOT_JOB, RANKING_SWEEP_JOB, isQueuePrefixValid } from './queue-names.js';

describe('isQueuePrefixValid', () => {
  it('accepts a prefix that embeds APP_ENV as a segment', () => {
    expect(isQueuePrefixValid('kamito-tt:staging', 'staging')).toBe(true);
  });

  it('rejects missing prefix or env', () => {
    expect(isQueuePrefixValid(undefined, 'staging')).toBe(false);
    expect(isQueuePrefixValid('kamito-tt:staging', '')).toBe(false);
  });

  it('rejects a prefix of another environment or a partial match', () => {
    expect(isQueuePrefixValid('kamito-tt:production', 'staging')).toBe(false);
    expect(isQueuePrefixValid('kamito-tt:staging2', 'staging')).toBe(false);
  });

  it('requires the kamito-tt namespace first', () => {
    expect(isQueuePrefixValid('staging', 'staging')).toBe(false);
    expect(isQueuePrefixValid('other:staging', 'staging')).toBe(false);
    expect(isQueuePrefixValid('kamito-tt:staging:blue', 'staging')).toBe(true);
  });
});

describe('ranking queue contract', () => {
  it('registers the ranking queue with three distinct job names', () => {
    expect(QueueName.Ranking).toBe('ranking');
    expect(new Set([RANKING_RECOMPUTE_JOB, RANKING_SNAPSHOT_JOB, RANKING_SWEEP_JOB]).size).toBe(3);
  });
});

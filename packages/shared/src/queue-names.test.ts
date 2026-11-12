import { describe, expect, it } from 'vitest';
import { isQueuePrefixValid } from './queue-names.js';

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

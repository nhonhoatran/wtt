import { describe, expect, it } from 'vitest';
import { judgeEvictionPolicy, parseConfigGetReply } from './redis-eviction-policy.js';

describe('judgeEvictionPolicy', () => {
  it('accepts noeviction everywhere', () => {
    expect(judgeEvictionPolicy({ policy: 'noeviction', appEnv: 'production' }).status).toBe('ok');
  });

  it('is fatal in production for an evicting or unreadable policy', () => {
    expect(judgeEvictionPolicy({ policy: 'allkeys-lru', appEnv: 'production' }).status).toBe('fatal');
    expect(judgeEvictionPolicy({ policy: undefined, appEnv: 'production' }).status).toBe('fatal');
  });

  it('only degrades outside production', () => {
    expect(judgeEvictionPolicy({ policy: 'volatile-lru', appEnv: 'staging' }).status).toBe('degraded');
  });

  it('honours an explicit override but ignores a blank one', () => {
    expect(judgeEvictionPolicy({ policy: undefined, appEnv: 'production', override: 'confirmed' }).status).toBe(
      'overridden',
    );
    expect(judgeEvictionPolicy({ policy: undefined, appEnv: 'production', override: '  ' }).status).toBe('fatal');
  });

  it('never waives a readable evicting policy, even with an override', () => {
    expect(judgeEvictionPolicy({ policy: 'allkeys-lru', appEnv: 'production', override: 'confirmed' }).status).toBe(
      'fatal',
    );
  });
});

describe('parseConfigGetReply', () => {
  it('extracts the value or returns undefined', () => {
    expect(parseConfigGetReply(['maxmemory-policy', 'noeviction'])).toBe('noeviction');
    expect(parseConfigGetReply([])).toBeUndefined();
    expect(parseConfigGetReply(null)).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { pickHomeRanking } from '../../src/lib/home-ranking-param';

const items = [{ list: { code: 'MS' } }, { list: { code: 'WS' } }];

describe('pickHomeRanking', () => {
  it('returns the list named by the parameter', () => {
    expect(pickHomeRanking(items, 'WS')).toBe(items[1]);
  });
  it('falls back to the first list for unknown, repeated or missing values', () => {
    expect(pickHomeRanking(items, 'bad')).toBe(items[0]);
    expect(pickHomeRanking(items, ['WS', 'MS'])).toBe(items[0]);
    expect(pickHomeRanking(items, undefined)).toBe(items[0]);
  });
  it('returns null when there are no lists', () => {
    expect(pickHomeRanking([], 'MS')).toBeNull();
  });
});

import { isValidCacheTag } from '@kamito/shared';
import { describe, expect, it } from 'vitest';
import { CACHE_TAGS } from './cache-tags.js';

describe('ranking.publish cache tags', () => {
  it('covers the ranking pages, the player index and each changed player', () => {
    const tags = CACHE_TAGS['ranking.publish']({ listCode: 'MS-OPEN', playerSlugs: ['nguyen-van-a', 'tran-b'] });
    expect(tags).toEqual(['rankings', 'ranking-MS-OPEN', 'players', 'player-nguyen-van-a', 'player-tran-b']);
    expect(tags.every(isValidCacheTag)).toBe(true);
  });

  it('refuses a list code that cannot be a tag part', () => {
    expect(() => CACHE_TAGS['ranking.publish']({ listCode: 'bad code', playerSlugs: [] })).toThrow(RangeError);
  });
});

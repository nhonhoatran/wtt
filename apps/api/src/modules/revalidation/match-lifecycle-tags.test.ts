import { isValidCacheTag } from '@kamito/shared';
import { describe, expect, it } from 'vitest';
import { CACHE_TAGS } from './cache-tags.js';

const context = { eventSlug: 'giai-2026', subEventCode: 'MS', matchNos: [5, 9], isGroupMatch: false, playerSlugs: ['nguyen-a', 'tran-b'] };

describe('match lifecycle cache tags', () => {
  it.each(['match.start', 'match.unStart', 'match.saveProgress'] as const)('%s covers the match pages and every player but not the results strip', (key) => {
    const tags = CACHE_TAGS[key](context);
    expect(tags).toEqual([
      'event-giai-2026',
      'schedule-giai-2026',
      'draw-giai-2026-MS',
      'match-giai-2026-5',
      'match-giai-2026-9',
      'player-nguyen-a',
      'player-tran-b',
    ]);
    expect(tags.every(isValidCacheTag)).toBe(true);
  });

  it.each(['match.amend', 'match.reopen'] as const)('%s also refreshes the results strip and the groups tag of a group match', (key) => {
    const tags = CACHE_TAGS[key]({ ...context, isGroupMatch: true });
    expect(tags).toContain('results-strip');
    expect(tags).toContain('groups-giai-2026-MS');
    expect(tags).toContain('match-giai-2026-9');
    expect(tags).toContain('player-tran-b');
  });
});

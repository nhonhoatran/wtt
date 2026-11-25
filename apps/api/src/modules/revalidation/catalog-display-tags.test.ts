import { isValidCacheTag } from '@kamito/shared';
import { describe, expect, it } from 'vitest';
import { CACHE_TAGS } from './cache-tags.js';

describe('venueTable.write tags', () => {
  const matches = [
    { eventSlug: 'giai-2026', subEventCode: 'MS', matchNo: 5, isGroupMatch: false, playerSlugs: ['an', 'binh'] },
    { eventSlug: 'giai-2026', subEventCode: 'WS', matchNo: 8, isGroupMatch: true, playerSlugs: ['chi'] },
  ];

  it('refreshes draw, groups, match pages and the results strip of every match on the table', () => {
    const tags = CACHE_TAGS['venueTable.write']({ matches });
    expect(tags).toEqual(expect.arrayContaining([
      'event-giai-2026', 'schedule-giai-2026',
      'draw-giai-2026-MS', 'match-giai-2026-5',
      'draw-giai-2026-WS', 'groups-giai-2026-WS', 'match-giai-2026-8',
      'results-strip', 'player-an', 'player-binh', 'player-chi',
    ]));
    expect(tags).not.toContain('groups-giai-2026-MS');
    expect(tags.every(isValidCacheTag)).toBe(true);
  });

  it('emits nothing for a table without matches', () => {
    expect(CACHE_TAGS['venueTable.write']({ matches: [] })).toEqual([]);
  });
});

describe('subEvent tags', () => {
  it.each(['subEvent.create', 'subEvent.update', 'subEvent.delete'] as const)('%s refreshes the event list because cards show sub-events', (key) => {
    const tags = CACHE_TAGS[key]({ eventSlug: 'giai-2026', subEventCodes: ['MS'] });
    expect(tags).toContain('events');
    expect(tags).toContain('event-giai-2026');
    expect(tags.every(isValidCacheTag)).toBe(true);
  });
});

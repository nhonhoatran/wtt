import { describe, expect, it } from 'vitest';
import { entryChangeTags } from './public-cache-tag-sets.js';
import { isValidCacheTag } from './public-cache-tags.js';

describe('entryChangeTags', () => {
  it('covers the event, draw and groups of every sub-event and the player pages', () => {
    const tags = entryChangeTags({ eventSlug: 'giai-1', subEventCodes: ['MS', 'WS'], playerSlugs: ['nguyen-a'] });
    expect(tags).toEqual(['event-giai-1', 'draw-giai-1-MS', 'groups-giai-1-MS', 'draw-giai-1-WS', 'groups-giai-1-WS', 'player-nguyen-a']);
    expect(tags.every(isValidCacheTag)).toBe(true);
  });

  it('adds the players list only when asked', () => {
    expect(entryChangeTags({ eventSlug: 'g', subEventCodes: [], playerSlugs: [], includePlayersList: true })).toEqual(['event-g', 'players']);
  });
});

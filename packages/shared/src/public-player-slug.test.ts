import { describe, expect, it } from 'vitest';
import { publicPlayerIdFromSlug, publicPlayerSlug } from './public-player-slug.js';
import { PUBLIC_URL_PART_PATTERN } from './public-api.js';

describe('public player identifiers', () => {
  const id = '9fa3d665-2e53-4124-823c-c494dc0545c4';

  it('uses a stable UUID route that contains no name and round-trips safely', () => {
    const slug = publicPlayerSlug(id.toUpperCase());
    expect(slug).toBe(`p-${id}`);
    expect(PUBLIC_URL_PART_PATTERN.test(slug)).toBe(true);
    expect(publicPlayerIdFromSlug(slug)).toBe(id);
  });

  it('does not mistake a legacy name slug or malformed input for an id', () => {
    for (const value of ['nguyen-van-an', id, `p-${id}/results`, `p-${id}?page=1`, `p-${id.slice(1)}`, 'p-not-a-uuid', '../players']) {
      expect(publicPlayerIdFromSlug(value)).toBeNull();
    }
    expect(() => publicPlayerSlug('nguyen-van-an')).toThrow(RangeError);
  });
});

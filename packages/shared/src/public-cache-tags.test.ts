import { describe, expect, it } from 'vitest';
import { CACHE_TAG_MAX_LENGTH, isValidCacheTag, publicCacheTags } from './public-cache-tags.js';

describe('publicCacheTags', () => {
  it('builds tags from public URL identifiers', () => {
    expect(publicCacheTags.match('giai-mo-rong-2026', 34)).toBe('match-giai-mo-rong-2026-34');
    expect(publicCacheTags.draw('giai-2026', 'MS')).toBe('draw-giai-2026-MS');
    expect(publicCacheTags.resultsStrip()).toBe('results-strip');
  });

  it('refuses parts that could break the tag', () => {
    expect(() => publicCacheTags.event('a b')).toThrow(RangeError);
    expect(() => publicCacheTags.draw('slug', '')).toThrow(RangeError);
  });

  it('validates tags received by the revalidate route', () => {
    expect(isValidCacheTag('draw-giai-2026-MS')).toBe(true);
    expect(isValidCacheTag('x'.repeat(CACHE_TAG_MAX_LENGTH + 1))).toBe(false);
    expect(isValidCacheTag('event-a/b')).toBe(false);
    expect(isValidCacheTag(42)).toBe(false);
  });
});

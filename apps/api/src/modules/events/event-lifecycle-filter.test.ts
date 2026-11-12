import { describe, expect, it } from 'vitest';
import { lifecycleFilter } from './event-lifecycle-filter.js';

// 2026-11-12T18:00Z is already 2026-11-13 in Hanoi but still 2026-11-12 in Berlin.
const NOW = new Date('2026-11-12T18:00:00Z');

describe('lifecycleFilter', () => {
  it('uses the calendar day of each timezone', () => {
    const where = lifecycleFilter(['Asia/Ho_Chi_Minh', 'Europe/Berlin'], NOW)('ONGOING') as {
      OR: { AND: [{ timezone: string }, { startDate: { lte: Date } }] }[];
    };
    const byZone = Object.fromEntries(where.OR.map(({ AND }) => [AND[0].timezone, AND[1].startDate.lte.toISOString().slice(0, 10)]));
    expect(byZone).toEqual({ 'Asia/Ho_Chi_Minh': '2026-11-13', 'Europe/Berlin': '2026-11-12' });
  });

  it('combines several lifecycles per timezone and rejects unknown values', () => {
    const filter = lifecycleFilter(['UTC'], NOW);
    expect((filter('UPCOMING,COMPLETED') as { OR: unknown[] }).OR).toHaveLength(2);
    expect(() => filter('SOON')).toThrow();
  });

  it('matches nothing when no event exists yet', () => {
    expect(lifecycleFilter([], NOW)('ONGOING')).toEqual({ OR: [] });
  });
});

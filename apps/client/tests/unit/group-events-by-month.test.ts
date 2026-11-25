import { describe, expect, it } from 'vitest';
import { groupEventsByMonth } from '../../src/lib/group-events-by-month';

const ev = (slug: string, startDate: string) => ({ slug, startDate });

describe('groupEventsByMonth', () => {
  it('returns no groups for an empty page', () => {
    expect(groupEventsByMonth([])).toEqual([]);
  });

  it('keeps the API order and starts a group when the month changes', () => {
    const groups = groupEventsByMonth([ev('a', '2027-03-12'), ev('b', '2027-03-30'), ev('c', '2027-04-18'), ev('d', '2027-05-05')]);
    expect(groups.map((g) => [g.month, g.items.map((i) => i.slug)])).toEqual([
      ['2027-03', ['a', 'b']],
      ['2027-04', ['c']],
      ['2027-05', ['d']],
    ]);
  });

  it('places an event that spans two months in the month it starts', () => {
    const spanning = { slug: 'x', startDate: '2027-03-30', endDate: '2027-04-02' };
    expect(groupEventsByMonth([spanning])[0]?.month).toBe('2027-03');
  });

  it('keeps the same month of different years apart', () => {
    expect(groupEventsByMonth([ev('a', '2026-12-30'), ev('b', '2027-12-01')]).map((g) => g.month)).toEqual(['2026-12', '2027-12']);
  });
});

import { describe, expect, it } from 'vitest';
import { planSponsorOrder, reorderSponsorsBody } from './sponsor-order.js';

describe('planSponsorOrder', () => {
  it('swaps the visible page slots while leaving other pages in place', () => {
    const scope = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, order) => ({ id, order }));
    expect(planSponsorOrder(scope, ['d', 'c'])).toEqual([
      { id: 'd', beforeOrder: 3, order: 2 }, { id: 'c', beforeOrder: 2, order: 3 },
    ]);
    expect(scope.map(({ id }) => id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('breaks existing ties and renumbers the whole scope densely', () => {
    expect(planSponsorOrder([
      { id: 'a', order: 0 }, { id: 'b', order: 0 }, { id: 'c', order: 0 },
      { id: 'd', order: 9 }, { id: 'e', order: 9 },
    ], ['c', 'b'])).toEqual([
      { id: 'c', beforeOrder: 0, order: 1 }, { id: 'b', beforeOrder: 0, order: 2 },
      { id: 'd', beforeOrder: 9, order: 3 }, { id: 'e', beforeOrder: 9, order: 4 },
    ]);
  });

  it('replaces only selected positions even if selection has gaps', () => {
    const scope = ['a', 'b', 'c', 'd', 'e'].map((id, order) => ({ id, order }));
    expect(planSponsorOrder(scope, ['e', 'b'])).toEqual([
      { id: 'e', beforeOrder: 4, order: 1 }, { id: 'b', beforeOrder: 1, order: 4 },
    ]);
  });

  it('rejects duplicate ids and ids from a different or deleted scope', () => {
    const scope = [{ id: 'a', order: 0 }, { id: 'b', order: 1 }];
    expect(() => planSponsorOrder(scope, ['a', 'a'])).toThrow(RangeError);
    expect(() => planSponsorOrder(scope, ['other-event'])).toThrow(RangeError);
    expect(() => planSponsorOrder(scope, [])).toThrow(RangeError);
  });

  it('does not write an already dense unchanged scope', () => {
    expect(planSponsorOrder([{ id: 'a', order: 0 }, { id: 'b', order: 1 }], ['b'])).toEqual([]);
  });

  it('requires an explicit event scope, valid ids and a bounded nonempty page', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(reorderSponsorsBody.safeParse({ eventId: null, orderedIds: [id] }).success).toBe(true);
    expect(reorderSponsorsBody.safeParse({ orderedIds: [id] }).success).toBe(false);
    expect(reorderSponsorsBody.safeParse({ eventId: null, orderedIds: [] }).success).toBe(false);
    expect(reorderSponsorsBody.safeParse({ eventId: null, orderedIds: ['not-a-uuid'] }).success).toBe(false);
    expect(reorderSponsorsBody.safeParse({ eventId: null, orderedIds: Array(1001).fill(id) }).success).toBe(false);
  });
});

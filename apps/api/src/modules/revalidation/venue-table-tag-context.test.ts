import { publicPlayerSlug } from '@kamito/shared';
import { describe, expect, it, vi } from 'vitest';
import { publicScope } from '../public-scope/public-scope.js';
import { loadVenueTableTagContext } from './public-tag-context.js';

const single = (id: string, slug: string) => ({ competitor: { player: { id, slug }, pair: null } });
const pair = (a: [string, string], b: [string, string]) => ({
  competitor: { player: null, pair: { playerA: { id: a[0], slug: a[1] }, playerB: { id: b[0], slug: b[1] } } },
});

describe('loadVenueTableTagContext', () => {
  it('restricts the lookup to public matches and returns player slugs of both sides', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { matchNo: 4, groupId: null, event: { slug: 'giai-1' }, subEvent: { code: 'MS' }, side1Entry: single('11111111-1111-4111-8111-111111111111', 'an'), side2Entry: null },
      { matchNo: 9, groupId: 'g1', event: { slug: 'giai-1' }, subEvent: { code: 'XD' }, side1Entry: pair(['22222222-2222-4222-8222-222222222222', 'binh'], ['33333333-3333-4333-8333-333333333333', 'chi']), side2Entry: single('44444444-4444-4444-8444-444444444444', 'dung') },
    ]);

    const context = await loadVenueTableTagContext({ match: { findMany } } as never, 't1');

    expect(findMany.mock.calls[0]![0].where).toEqual({ tableId: 't1', ...publicScope.matchIn({}) });
    expect(context.matches[0]).toEqual({ eventSlug: 'giai-1', subEventCode: 'MS', matchNo: 4, isGroupMatch: false, playerSlugs: ['an', publicPlayerSlug('11111111-1111-4111-8111-111111111111')] });
    expect(context.matches[1]!.isGroupMatch).toBe(true);
    expect(context.matches[1]!.playerSlugs).toEqual(['binh', publicPlayerSlug('22222222-2222-4222-8222-222222222222'), 'chi', publicPlayerSlug('33333333-3333-4333-8333-333333333333'), 'dung', publicPlayerSlug('44444444-4444-4444-8444-444444444444')]);
  });
});

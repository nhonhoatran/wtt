import { z } from 'zod';

export const reorderSponsorsBody = z.object({
  eventId: z.string().uuid().nullable(),
  // Technical request-size bound; the browser normally submits only one paginated page.
  orderedIds: z.array(z.string().uuid()).min(1).max(1_000),
});

export interface SponsorOrderRow { id: string; order: number }
export interface SponsorOrderChange { id: string; beforeOrder: number; order: number }

/** The scope arrives in database order/name/id order; unsubmitted rows keep their relative slots. */
export function planSponsorOrder(scope: readonly SponsorOrderRow[], orderedIds: readonly string[]): SponsorOrderChange[] {
  const selected = new Set(orderedIds);
  const byId = new Map(scope.map((row) => [row.id, row]));
  if (!orderedIds.length || selected.size !== orderedIds.length) throw new RangeError('Mã nhà tài trợ phải khác nhau');
  if (orderedIds.some((id) => !byId.has(id))) throw new RangeError('Nhà tài trợ không thuộc phạm vi giải đã chọn');
  let next = 0;
  return scope.flatMap((row, index) => {
    const id = selected.has(row.id) ? orderedIds[next++]! : row.id;
    const beforeOrder = byId.get(id)!.order;
    return beforeOrder === index ? [] : [{ id, beforeOrder, order: index }];
  });
}

import type { Prisma } from '@kamito/db';
import type { DrawTagContext } from '../revalidation/cache-tags.js';

export async function loadDrawTagContext(db: Prisma.TransactionClient, drawId: string): Promise<DrawTagContext> {
  const draw = await db.draw.findUniqueOrThrow({
    where: { id: drawId },
    select: { kind: true, subEvent: { select: { code: true, event: { select: { slug: true } } } } },
  });
  return { eventSlug: draw.subEvent.event.slug, subEventCode: draw.subEvent.code, hasGroups: draw.kind === 'GROUP' };
}

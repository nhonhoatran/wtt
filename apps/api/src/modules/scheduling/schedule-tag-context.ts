import type { Prisma } from '@kamito/db';
import type { ScheduleTagContext } from '../revalidation/cache-tags.js';

/** Public identifiers behind a schedule change: the event slug and the sub-event codes of the matches whose slot or time moved. */
export async function loadScheduleTagContext(db: Pick<Prisma.TransactionClient, 'event' | 'match'>, eventId: string, matchNos: number[]): Promise<ScheduleTagContext> {
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId }, select: { slug: true } });
  const rows = matchNos.length ? await db.match.findMany({ where: { eventId, matchNo: { in: matchNos } }, select: { subEvent: { select: { code: true } } } }) : [];
  return { eventSlug: event.slug, matchNos, subEventCodes: [...new Set(rows.map((r) => r.subEvent.code))] };
}

import type { Prisma } from '@kamito/db';
import type { SubEventUsageTagContext } from './cache-tags.js';

type Db = Pick<Prisma.TransactionClient, 'event' | 'subEvent' | 'match'>;

export async function loadEventSlugs(db: Db, where: Prisma.EventWhereInput): Promise<string[]> {
  const rows = await db.event.findMany({ where, select: { slug: true } });
  return rows.map((row) => row.slug);
}

/** Events with sub-events matching `where`, with those sub-events' codes and match numbers (their public pages show the sub-event name). */
export async function loadSubEventUsage(db: Db, where: Prisma.SubEventWhereInput): Promise<SubEventUsageTagContext> {
  const [subEvents, matches] = await Promise.all([
    db.subEvent.findMany({ where, select: { code: true, event: { select: { slug: true } } } }),
    db.match.findMany({ where: { subEvent: where }, select: { matchNo: true, event: { select: { slug: true } } } }),
  ]);
  const byEvent = new Map<string, { eventSlug: string; subEventCodes: string[]; matchNos: number[] }>();
  const slot = (eventSlug: string) => byEvent.get(eventSlug) ?? byEvent.set(eventSlug, { eventSlug, subEventCodes: [], matchNos: [] }).get(eventSlug)!;
  for (const row of subEvents) slot(row.event.slug).subEventCodes.push(row.code);
  for (const row of matches) slot(row.event.slug).matchNos.push(row.matchNo);
  return { events: [...byEvent.values()] };
}

import { Prisma } from '@kamito/db';
import type { PrismaService } from '../prisma/prisma.service.js';
import { publicScope } from '../public-scope/public-scope.js';
import { PUBLIC_EVENT_CARD_SELECT } from './public-event.serializer.js';

/** Reads the next published events using each event's local calendar day. */
export async function publicHomeEvents(prisma: PrismaService, now: Date, limit: number, featuredOnly = false) {
  const offsetMinutes = Prisma.sql`(CASE WHEN left(e.timezone, 1) = '-' THEN -1 ELSE 1 END) * (substring(e.timezone, 2, 2)::int * 60 + CASE WHEN length(e.timezone) > 3 THEN right(e.timezone, 2)::int ELSE 0 END)`;
  const today = Prisma.sql`CASE WHEN e.timezone ~ '^[+-]' THEN (${now}::timestamptz AT TIME ZONE 'UTC' + make_interval(mins => ${offsetMinutes}))::date ELSE (${now}::timestamptz AT TIME ZONE e.timezone)::date END`;
  const featured = featuredOnly ? Prisma.sql`AND e."isFeatured" = true` : Prisma.empty;
  const ids = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT e.id FROM "Event" e
    WHERE e."publishStatus" = ${publicScope.events.publishStatus}::"PublishStatus"
      AND e."isCancelled" = ${publicScope.events.isCancelled}
      AND e."endDate" >= ${today}
      ${featured}
    ORDER BY e."startDate" ASC, e.slug ASC
    LIMIT ${limit}
  `);
  if (!ids.length) return [];

  const rows = await prisma.event.findMany({
    where: { ...publicScope.events, id: { in: ids.map(({ id }) => id) } },
    select: { ...PUBLIC_EVENT_CARD_SELECT, id: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap(({ id }) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

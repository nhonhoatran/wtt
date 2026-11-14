import type { Prisma } from '@kamito/db';
import { formatDateOnly } from '../events/date-only.js';
import { instantToHhmm } from './session-time.js';

export const SESSION_INCLUDE = {
  tables: { orderBy: { order: 'asc' }, select: { order: true, table: { select: { id: true, code: true, displayName: true } } } },
  _count: { select: { matches: true } },
} satisfies Prisma.EventSessionInclude;

type SessionRow = Prisma.EventSessionGetPayload<{ include: typeof SESSION_INCLUDE }>;

export function toSessionView(row: SessionRow, timezone: string) {
  return {
    id: row.id,
    eventId: row.eventId,
    venueId: row.venueId,
    date: formatDateOnly(row.date),
    code: row.code,
    name: row.name,
    nameEn: row.nameEn,
    startTime: instantToHhmm(row.startTime, timezone),
    endTime: row.endTime ? instantToHhmm(row.endTime, timezone) : null,
    startsAt: row.startTime.toISOString(),
    tables: row.tables.map((t) => ({ tableId: t.table.id, code: t.table.code, displayName: t.table.displayName, order: t.order })),
    matchCount: row._count.matches,
  };
}

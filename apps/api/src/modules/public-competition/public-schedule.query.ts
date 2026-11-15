import { Injectable } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import type { PublicSchedule } from '@kamito/shared';
import { formatDateOnly } from '../events/date-only.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { parsePublicCode } from '../public-scope/public-query-params.js';
import { publicScope } from '../public-scope/public-scope.js';
import { PUBLIC_MATCH_CARD_SELECT, toPublicMatchCard } from './public-match.serializer.js';

export interface PublicScheduleQueryParams { session?: unknown; table?: unknown }

/** A scheduled slot must have all three parts; partially populated/imported rows are not a public timetable. */
export const publicScheduledMatch = (slug: string): Prisma.MatchWhereInput => ({
  ...publicScope.match(slug), sessionId: { not: null }, tableId: { not: null }, scheduledAt: { not: null },
});

@Injectable()
export class PublicScheduleQuery {
  constructor(private readonly prisma: PrismaService) {}

  /** Three bounded query shapes, independent of the number of sessions or tables. All filtering happens on the server. */
  async schedule(slug: string, query: PublicScheduleQueryParams): Promise<PublicSchedule | null> {
    const event = await this.prisma.event.findFirst({
      where: publicScope.event(slug), select: { slug: true, name: true, nameEn: true, timezone: true },
    });
    if (!event) return null;
    const sessionCode = parsePublicCode(query.session);
    const tableCode = parsePublicCode(query.table);
    const visible = publicScheduledMatch(slug);
    const [options, sessions] = await Promise.all([
      this.prisma.eventSession.findMany({
        where: { event: publicScope.event(slug), matches: { some: visible } },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { code: 'asc' }],
        select: {
          code: true, name: true, nameEn: true, date: true,
          matches: { where: visible, orderBy: { table: { code: 'asc' } }, select: { table: { select: { code: true, displayName: true } } } },
        },
      }),
      this.prisma.eventSession.findMany({
        where: { event: publicScope.event(slug), ...(sessionCode && { code: sessionCode }), matches: { some: { ...visible, ...(tableCode && { table: { code: tableCode } }) } } },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { code: 'asc' }],
        select: {
          code: true, name: true, nameEn: true, date: true, startTime: true, endTime: true,
          venue: { select: { name: true, nameEn: true } },
          tables: {
            orderBy: { order: 'asc' },
            ...(tableCode && { where: { table: { code: tableCode } } }),
            select: { tableId: true, table: { select: { code: true, displayName: true } } },
          },
          matches: {
            where: { ...visible, ...(tableCode && { table: { code: tableCode } }) },
            orderBy: [{ orderInSession: { sort: 'asc', nulls: 'last' } }, { scheduledAt: 'asc' }, { matchNo: 'asc' }],
            select: { ...PUBLIC_MATCH_CARD_SELECT, tableId: true },
          },
        },
      }),
    ]);
    const tables = new Map<string, { code: string; displayName: string | null }>();
    for (const session of options) for (const { table } of session.matches) if (table && !tables.has(table.code)) tables.set(table.code, { code: table.code, displayName: table.displayName });
    return {
      event,
      filters: {
        sessions: options.map((s) => ({ code: s.code, name: s.name, nameEn: s.nameEn, date: formatDateOnly(s.date) })),
        tables: [...tables.values()],
      },
      sessions: sessions.map((s) => ({
        code: s.code, name: s.name, nameEn: s.nameEn, date: formatDateOnly(s.date),
        startsAt: s.startTime.toISOString(), endsAt: s.endTime?.toISOString() ?? null,
        venue: s.venue ? { name: s.venue.name, nameEn: s.venue.nameEn } : null,
        tables: s.tables.map(({ tableId, table }) => ({
          code: table.code, displayName: table.displayName,
          matches: s.matches.filter((m) => m.tableId === tableId).map(toPublicMatchCard),
        })).filter((t) => t.matches.length > 0),
      })).filter((s) => s.tables.length > 0),
    };
  }
}

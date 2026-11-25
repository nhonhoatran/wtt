import { Injectable } from '@nestjs/common';
import { Prisma } from '@kamito/db';
import { dashboardSettings } from '@kamito/shared';
import { formatDateOnly } from '../events/date-only.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { ongoingCandidateWhere, pickOngoing, todayMatchWhere } from './dashboard-today-window.js';

const TIER_BRIEF = { select: { name: true, colorHex: true } } as const;

/** Same "counts toward progress" rule as the event hub: no byes, walkovers or voided matches. */
const progressWhere = (eventIds: string[]): Prisma.MatchWhereInput => ({
  eventId: { in: eventIds },
  isVoided: false,
  OR: [{ resultType: null }, { resultType: { notIn: ['BYE', 'WALKOVER'] } }],
});

/** Distinct players with a CONFIRMED entry, singles and both members of a pair. */
const activePlayersSql = (eventIds: string[]) => Prisma.sql`
  SELECT COUNT(*)::int AS count FROM (
    SELECT c."playerId" AS pid FROM "Entry" e
      JOIN "SubEvent" s ON s."id" = e."subEventId" JOIN "Competitor" c ON c."id" = e."competitorId"
      WHERE e."status" = 'CONFIRMED' AND s."eventId" IN (${Prisma.join(eventIds)}) AND c."playerId" IS NOT NULL
    UNION
    SELECT p."playerAId" FROM "Entry" e
      JOIN "SubEvent" s ON s."id" = e."subEventId" JOIN "Competitor" c ON c."id" = e."competitorId" JOIN "Pair" p ON p."id" = c."pairId"
      WHERE e."status" = 'CONFIRMED' AND s."eventId" IN (${Prisma.join(eventIds)})
    UNION
    SELECT p."playerBId" FROM "Entry" e
      JOIN "SubEvent" s ON s."id" = e."subEventId" JOIN "Competitor" c ON c."id" = e."competitorId" JOIN "Pair" p ON p."id" = c."pairId"
      WHERE e."status" = 'CONFIRMED' AND s."eventId" IN (${Prisma.join(eventIds)})
  ) AS players`;

@Injectable()
export class DashboardSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
  ) {}

  /** One query for the ongoing events, then one transaction of four aggregates; never loads match rows. */
  async get(now: Date = new Date()) {
    const [limit, recentActivityLimit, candidates] = await Promise.all([
      this.settings.get(dashboardSettings.liveEventLimit),
      this.settings.get(dashboardSettings.recentActivityLimit),
      this.prisma.event.findMany({
        where: ongoingCandidateWhere(now),
        orderBy: [{ startDate: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          timezone: true,
          startDate: true,
          endDate: true,
          isCancelled: true,
          eventType: { select: { name: true, colorHex: true, tier: TIER_BRIEF } },
          venue: { select: { name: true, city: true } },
        },
      }),
    ]);
    const live = pickOngoing(candidates, now);
    if (live.length === 0) return { liveEvents: 0, pendingToday: 0, overdueToday: 0, finishedToday: 0, activePlayers: 0, recentActivityLimit, events: [] };

    const ids = live.map((event) => event.id);
    const today = todayMatchWhere(live, now);
    const [byStatus, overdue, progress, players] = await this.prisma.$transaction([
      this.prisma.match.groupBy({ by: ['status'], where: today, orderBy: { status: 'asc' }, _count: { _all: true } }),
      this.prisma.match.count({ where: { AND: [today, { status: 'SCHEDULED', scheduledAt: { lt: now } }] } }),
      this.prisma.match.groupBy({ by: ['eventId', 'status'], where: progressWhere(ids), orderBy: { eventId: 'asc' }, _count: { _all: true } }),
      this.prisma.$queryRaw<{ count: number }[]>(activePlayersSql(ids)),
    ]);

    const todayCount = (...statuses: string[]) => byStatus.filter((row) => statuses.includes(row.status)).reduce((sum, row) => sum + row._count._all, 0);
    const totals = new Map<string, { total: number; official: number }>();
    for (const row of progress) {
      const entry = totals.get(row.eventId) ?? { total: 0, official: 0 };
      entry.total += row._count._all;
      if (row.status === 'OFFICIAL') entry.official += row._count._all;
      totals.set(row.eventId, entry);
    }

    return {
      liveEvents: live.length,
      pendingToday: todayCount('SCHEDULED', 'LIVE'),
      overdueToday: overdue,
      finishedToday: todayCount('OFFICIAL'),
      activePlayers: players[0]?.count ?? 0,
      recentActivityLimit,
      events: live.slice(0, limit).map((event) => ({
        id: event.id,
        name: event.name,
        eventType: { name: event.eventType.name, colorHex: event.eventType.colorHex, tier: event.eventType.tier },
        startDate: formatDateOnly(event.startDate),
        endDate: formatDateOnly(event.endDate),
        venue: event.venue,
        matches: totals.get(event.id) ?? { total: 0, official: 0 },
      })),
    };
  }
}

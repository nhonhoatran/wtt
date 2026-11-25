import { Injectable } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import { toPaginatedResult } from '../../common/pagination/pagination-query.js';
import type { PaginationQueryShape } from '@kamito/shared';
import { ENTRY_BRIEF_SELECT, toEntryBrief } from '../matches/match-view.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ongoingCandidateWhere, pickOngoing, todayMatchWhere } from './dashboard-today-window.js';

const PENDING_INCLUDE = {
  event: { select: { name: true, timezone: true } },
  subEvent: { select: { code: true, name: true } },
  round: { select: { code: true } },
  table: { select: { code: true, displayName: true } },
  side1Entry: { select: ENTRY_BRIEF_SELECT },
  side2Entry: { select: ENTRY_BRIEF_SELECT },
} satisfies Prisma.MatchInclude;

@Injectable()
export class DashboardPendingMatchesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Today's open matches (scheduled or live) of ongoing events, earliest first; one page per call. */
  async list(query: PaginationQueryShape, now: Date = new Date()) {
    const candidates = await this.prisma.event.findMany({
      where: ongoingCandidateWhere(now),
      select: { id: true, timezone: true, startDate: true, endDate: true, isCancelled: true },
    });
    const live = pickOngoing(candidates, now);
    if (live.length === 0) return toPaginatedResult([], 0, query);

    const where: Prisma.MatchWhereInput = { AND: [todayMatchWhere(live, now), { status: { in: ['SCHEDULED', 'LIVE'] } }] };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.match.findMany({
        where,
        include: PENDING_INCLUDE,
        orderBy: [{ scheduledAt: 'asc' }, { matchNo: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.match.count({ where }),
    ]);
    const data = rows.map((match) => ({
      id: match.id,
      matchNo: match.matchNo,
      eventId: match.eventId,
      eventName: match.event.name,
      scheduledAt: match.scheduledAt?.toISOString() ?? null,
      timezone: match.event.timezone,
      table: match.table ? { code: match.table.code, displayName: match.table.displayName } : null,
      subEvent: { code: match.subEvent.code, name: match.subEvent.name ?? match.subEvent.code },
      round: { code: match.round.code },
      side1: toEntryBrief(match.side1Entry),
      side2: toEntryBrief(match.side2Entry),
      status: match.status,
    }));
    return toPaginatedResult(data, total, query);
  }
}

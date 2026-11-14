import { Injectable, NotFoundException } from '@nestjs/common';
import { tournamentSettings } from '@kamito/shared';
import { formatDateOnly } from '../events/date-only.js';
import { MATCH_RESULT_INCLUDE, resolveMatchFormat } from '../matches/match-result-view.js';
import { toEntryBrief } from '../matches/match-view.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppSettingsService } from '../settings/app-settings.service.js';

const SHEET_INCLUDE = { ...MATCH_RESULT_INCLUDE, session: { select: { code: true, date: true } } } as const;

const clubOf = (side: ReturnType<typeof toEntryBrief>) => [...new Set((side?.players ?? []).map((p) => p.club).filter((c): c is string => Boolean(c)))].join(' / ');

const sideSheet = (side: ReturnType<typeof toEntryBrief>) => ({ name: side?.displayName ?? '', club: clubOf(side) });

@Injectable()
export class MatchSheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
  ) {}

  /** Scheduled, playable matches of an event (optionally of one session and/or table) in print order: session, table, slot. */
  async forEvent(eventId: string, filter: { sessionId?: string; tableId?: string }) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true, name: true, nameEn: true, timezone: true } });
    if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Không tìm thấy giải đấu' });
    const cap = await this.settings.get(tournamentSettings.scheduleSessionMatchCap);
    const where = { eventId, isVoided: false, sessionId: filter.sessionId ?? { not: null }, ...(filter.tableId && { tableId: filter.tableId }) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.match.findMany({
        where,
        include: SHEET_INCLUDE,
        orderBy: [{ session: { date: 'asc' } }, { session: { startTime: 'asc' } }, { sessionId: 'asc' }, { tableId: 'asc' }, { orderInSession: 'asc' }],
        take: cap,
      }),
      this.prisma.match.count({ where }),
    ]);
    const columns = await this.prisma.eventSessionTable.findMany({ where: { sessionId: { in: [...new Set(rows.flatMap((m) => (m.sessionId ? [m.sessionId] : [])))] } } });
    const columnOrder = new Map(columns.map((c) => [`${c.sessionId}:${c.tableId}`, c.order]));
    const colOf = (m: (typeof rows)[number]) => columnOrder.get(`${m.sessionId}:${m.tableId}`) ?? 0;
    const rank = new Map<string, number>();
    for (const m of rows) if (m.sessionId && !rank.has(m.sessionId)) rank.set(m.sessionId, rank.size);
    // Print order follows the grid: sessions by date and start, then the session's own table order, not the venue's.
    rows.sort((a, b) => (rank.get(a.sessionId ?? '') ?? 0) - (rank.get(b.sessionId ?? '') ?? 0) || colOf(a) - colOf(b) || (a.orderInSession ?? 0) - (b.orderInSession ?? 0));
    const sheets = rows.map((m) => {
      const format = resolveMatchFormat(m);
      return {
        matchId: m.id,
        matchNo: m.matchNo,
        sessionCode: m.session?.code ?? null,
        sessionDate: m.session ? formatDateOnly(m.session.date) : null,
        tableCode: m.table?.code ?? null,
        tableName: m.table ? (m.table.displayName ?? m.table.code) : null,
        orderInSession: m.orderInSession,
        scheduledAt: m.scheduledAt?.toISOString() ?? null,
        subEventCode: m.subEvent.code,
        subEventName: m.subEvent.name ?? m.subEvent.code,
        roundCode: m.round.code,
        groupCode: m.group?.code ?? null,
        bestOf: format.bestOf,
        pointsPerGame: format.pointsPerGame,
        winBy: format.winBy,
        side1: sideSheet(toEntryBrief(m.side1Entry)),
        side2: sideSheet(toEntryBrief(m.side2Entry)),
      };
    });
    return { data: { event, sheets, truncated: total > sheets.length } };
  }
}

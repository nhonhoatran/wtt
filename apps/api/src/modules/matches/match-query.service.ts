import { Injectable } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import { normalizePersonName, tournamentSettings, type PaginationQueryShape } from '@kamito/shared';
import { buildListWhere, idFilter, invalidQuery, prismaListQuery, type ListDelegate, type ListSpec } from '../../common/crud/prisma-list-query.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScheduleConflictService } from '../scheduling/schedule-conflict.service.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { matchNotFound } from '../match-results/match-result-errors.js';
import { MATCH_DETAIL_INCLUDE, MATCH_RESULT_INCLUDE, toMatchDetail, toMatchResultItem, type MatchResultRow } from './match-result-view.js';
import { MATCH_VIEW_INCLUDE, toMatchView } from './match-view.js';

const STATUSES = ['SCHEDULED', 'LIVE', 'OFFICIAL'];

export const EVENT_MATCH_LIST_SPEC = {
  sortable: ['matchNo', 'scheduledAt', 'orderInSession'],
  defaultSort: { field: 'matchNo', direction: 'asc' },
  filters: {
    status: (value: string) => {
      const values = value === 'OPEN' ? ['SCHEDULED', 'LIVE'] : value.split(',');
      if (!values.every((v) => STATUSES.includes(v))) throw invalidQuery('Unknown status');
      return { status: { in: values } };
    },
    subEventId: idFilter('subEventId'),
    roundId: idFilter('roundId'),
    sessionId: idFilter('sessionId'),
    tableId: idFilter('tableId'),
    unscheduled: (value: string) => {
      if (value !== 'true' && value !== 'false') throw invalidQuery('unscheduled must be true or false');
      return { sessionId: value === 'true' ? null : { not: null } };
    },
  },
} satisfies ListSpec;

const NOT_BYE: Prisma.MatchWhereInput = { OR: [{ resultType: null }, { resultType: { not: 'BYE' } }] };

function sideSearch(q: string): Prisma.EntryWhereInput {
  const name = normalizePersonName(q);
  return {
    competitor: {
      OR: [
        { displayName: { contains: q, mode: 'insensitive' } },
        { player: { normalizedName: { contains: name } } },
        { pair: { OR: [{ playerA: { normalizedName: { contains: name } } }, { playerB: { normalizedName: { contains: name } } }] } },
      ],
    },
  };
}

function searchWhere(q: string | undefined): Prisma.MatchWhereInput {
  const term = q?.trim().replace(/^#/, '');
  if (!term) return {};
  if (/^\d+$/.test(term)) return { matchNo: Number(term) };
  return { OR: [{ side1Entry: sideSearch(term) }, { side2Entry: sideSearch(term) }] };
}

@Injectable()
export class MatchQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conflicts: ScheduleConflictService,
    private readonly settings: AppSettingsService,
  ) {}

  /** One joined query; ordered the way the bracket and round-robin screens read them. */
  async listForDraw(drawId: string, extraWhere: Prisma.MatchWhereInput = {}) {
    const rows = await this.prisma.match.findMany({
      where: { drawId, ...extraWhere },
      include: MATCH_VIEW_INCLUDE,
      orderBy: [{ round: { scopeKey: 'asc' } }, { round: { number: 'asc' } }, { orderInRound: 'asc' }],
    });
    return rows.map(toMatchView);
  }

  /**
   * Result-entry and scheduling list of an event: published draws only; BYEs and voided group matches never listed.
   * Filtered by session it returns the whole session unpaged (capped by a setting) with `conflicts[]` per match, as the
   * schedule grid needs; other lists carry conflicts only with `include=conflicts` (the computation spans the whole event).
   */
  async listForEvent(eventId: string, query: PaginationQueryShape, options: { includeConflicts?: boolean } = {}) {
    const base: Prisma.MatchWhereInput = { AND: [{ eventId, isVoided: false, draw: { status: 'PUBLISHED' } }, NOT_BYE, searchWhere(query.q)] };
    const page = query.filter.sessionId ? await this.listSession(query, base) : await prismaListQuery<MatchResultRow>(this.prisma, this.prisma.match as unknown as ListDelegate<MatchResultRow>, { ...query, q: undefined }, EVENT_MATCH_LIST_SPEC, { baseWhere: base, include: MATCH_RESULT_INCLUDE });
    const items = page.data.map(toMatchResultItem);
    if (!query.filter.sessionId && !options.includeConflicts) return { ...page, data: items };
    const conflicts = await this.conflicts.forEvent(eventId);
    return { ...page, data: items.map((m) => ({ ...m, conflicts: conflicts.get(m.id) ?? [] })) };
  }

  private async listSession(query: PaginationQueryShape, base: Prisma.MatchWhereInput) {
    const cap = await this.settings.get(tournamentSettings.scheduleSessionMatchCap);
    const where = buildListWhere({ ...query, q: undefined }, EVENT_MATCH_LIST_SPEC, base as Record<string, unknown>);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.match.findMany({ where: where as Prisma.MatchWhereInput, include: MATCH_RESULT_INCLUDE, orderBy: [{ orderInSession: 'asc' }, { matchNo: 'asc' }], take: cap }),
      this.prisma.match.count({ where: where as Prisma.MatchWhereInput }),
    ]);
    return { data, total, page: 1, pageSize: Math.max(data.length, 1), truncated: total > data.length };
  }

  async detail(id: string, client: Pick<Prisma.TransactionClient, 'match'> = this.prisma) {
    const row = await client.match.findUnique({ where: { id }, include: MATCH_DETAIL_INCLUDE });
    if (!row) throw matchNotFound();
    return toMatchDetail(row);
  }
}

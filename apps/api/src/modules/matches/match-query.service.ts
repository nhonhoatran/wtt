import { Injectable } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import { normalizePersonName, type PaginationQueryShape } from '@kamito/shared';
import { idFilter, invalidQuery, prismaListQuery, type ListDelegate, type ListSpec } from '../../common/crud/prisma-list-query.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { matchNotFound } from '../match-results/match-result-errors.js';
import { MATCH_DETAIL_INCLUDE, MATCH_RESULT_INCLUDE, toMatchDetail, toMatchResultItem, type MatchResultRow } from './match-result-view.js';
import { MATCH_VIEW_INCLUDE, toMatchView } from './match-view.js';

const STATUSES = ['SCHEDULED', 'LIVE', 'OFFICIAL'];

export const EVENT_MATCH_LIST_SPEC = {
  sortable: ['matchNo'],
  defaultSort: { field: 'matchNo', direction: 'asc' },
  filters: {
    status: (value: string) => {
      const values = value === 'OPEN' ? ['SCHEDULED', 'LIVE'] : value.split(',');
      if (!values.every((v) => STATUSES.includes(v))) throw invalidQuery('Unknown status');
      return { status: { in: values } };
    },
    subEventId: idFilter('subEventId'),
    roundId: idFilter('roundId'),
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
  constructor(private readonly prisma: PrismaService) {}

  /** One joined query; ordered the way the bracket and round-robin screens read them. */
  async listForDraw(drawId: string, extraWhere: Prisma.MatchWhereInput = {}) {
    const rows = await this.prisma.match.findMany({
      where: { drawId, ...extraWhere },
      include: MATCH_VIEW_INCLUDE,
      orderBy: [{ round: { scopeKey: 'asc' } }, { round: { number: 'asc' } }, { orderInRound: 'asc' }],
    });
    return rows.map(toMatchView);
  }

  /** Result-entry list of an event: published draws only; BYEs and voided group matches never listed. */
  async listForEvent(eventId: string, query: PaginationQueryShape) {
    const page = await prismaListQuery<MatchResultRow>(this.prisma, this.prisma.match as unknown as ListDelegate<MatchResultRow>, { ...query, q: undefined }, EVENT_MATCH_LIST_SPEC, {
      baseWhere: { AND: [{ eventId, isVoided: false, draw: { status: 'PUBLISHED' } }, NOT_BYE, searchWhere(query.q)] },
      include: MATCH_RESULT_INCLUDE,
    });
    return { ...page, data: page.data.map(toMatchResultItem) };
  }

  async detail(id: string, client: Pick<Prisma.TransactionClient, 'match'> = this.prisma) {
    const row = await client.match.findUnique({ where: { id }, include: MATCH_DETAIL_INCLUDE });
    if (!row) throw matchNotFound();
    return toMatchDetail(row);
  }
}

import { Injectable } from '@nestjs/common';
import type { PaginationQueryShape } from '@kamito/shared';
import { type FilterConverter, enumFilter, idFilter, invalidQuery, prismaListQuery } from '../../common/crud/prisma-list-query.js';
import { dateFromIso, todayIso } from '../../common/validation/iso-date-field.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Valid today means not yet expired; `false` lists the expired rows. */
const activeFilter: FilterConverter = (value) => {
  if (value !== 'true' && value !== 'false') throw invalidQuery('active must be true or false');
  const today = dateFromIso(todayIso());
  return value === 'true' ? { expiresAt: { gt: today } } : { expiresAt: { lte: today } };
};

export const RANKING_POINTS_SPEC = {
  sortable: ['earnedAt', 'expiresAt', 'points', 'createdAt'],
  defaultSort: { field: 'earnedAt', direction: 'desc' },
  filters: {
    rankingListId: idFilter('rankingListId'),
    playerId: idFilter('playerId'),
    eventId: idFilter('eventId'),
    source: enumFilter('source', ['AUTO', 'MANUAL']),
    active: activeFilter,
  },
} as const;

const INCLUDE = {
  player: { select: { id: true, code: true, fullName: true } },
  event: { select: { id: true, slug: true, name: true, nameEn: true } },
  rankingList: { select: { id: true, code: true, name: true } },
} as const;

@Injectable()
export class RankingPointsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: PaginationQueryShape) {
    const q = query.q;
    const baseWhere = q
      ? { player: { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }] } }
      : {};
    return prismaListQuery(this.prisma, this.prisma.rankingPointsEarned, query, RANKING_POINTS_SPEC, { baseWhere, include: INCLUDE });
  }
}

import { Injectable } from '@nestjs/common';
import type { PaginationQueryShape } from '@kamito/shared';
import { type FilterConverter, enumFilter, idFilter, invalidQuery, prismaListQuery } from '../../common/crud/prisma-list-query.js';
import { dateFromIso } from '../../common/validation/iso-date-field.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { rankingToday } from '../ranking-jobs/ranking-today.js';
import { AppSettingsService } from '../settings/app-settings.service.js';

/** Valid today means not yet expired; `false` lists the expired rows. */
const activeFilter = (todayIsoDate: string): FilterConverter => (value) => {
  if (value !== 'true' && value !== 'false') throw invalidQuery('active must be true or false');
  const today = dateFromIso(todayIsoDate);
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
    active: activeFilter(''),
  },
} as const;

const INCLUDE = {
  player: { select: { id: true, code: true, fullName: true } },
  event: { select: { id: true, slug: true, name: true, nameEn: true } },
  subEvent: { select: { id: true, code: true, name: true } },
  rankingList: { select: { id: true, code: true, name: true } },
} as const;

@Injectable()
export class RankingPointsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
  ) {}

  async list(query: PaginationQueryShape) {
    const q = query.q;
    const baseWhere = q
      ? { player: { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }] } }
      : {};
    // The exported spec only names the allowed filters; the real `active` converter needs today in the app timezone.
    const spec = { ...RANKING_POINTS_SPEC, filters: { ...RANKING_POINTS_SPEC.filters, active: activeFilter(await rankingToday(this.settings)) } };
    return prismaListQuery(this.prisma, this.prisma.rankingPointsEarned, query, spec, { baseWhere, include: INCLUDE });
  }
}

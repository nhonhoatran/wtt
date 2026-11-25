import { Injectable, NotFoundException } from '@nestjs/common';
import { findDirtySubEventIds } from '@kamito/db';
import type { PaginationQueryShape } from '@kamito/shared';
import { booleanFilter, enumFilter, idFilter, prismaListQuery } from '../../common/crud/prisma-list-query.js';
import { toPaginatedResult } from '../../common/pagination/pagination-query.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { findPreviousSnapshot } from './ranking-snapshot-previous.js';

export const RANKING_SNAPSHOT_SPEC = {
  sortable: ['asOfDate', 'createdAt', 'publishedAt'],
  defaultSort: { field: 'asOfDate', direction: 'desc' },
  filters: { listId: idFilter('rankingListId'), status: enumFilter('status', ['DRAFT', 'PUBLISHED']) },
} as const;

export const RANKING_ROWS_RULES = { sortable: ['rank', 'points', 'movement', 'resultsCounted'], filterable: ['changed'] } as const;

const INCLUDE = { rankingList: { select: { id: true, code: true, name: true } }, _count: { select: { rows: true } } } as const;

type Publisher = { id: string; name: string };

@Injectable()
export class RankingSnapshotsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Each snapshot carries how many of its list's sub-events still wait for a recompute. */
  async list(query: PaginationQueryShape) {
    const page = await prismaListQuery(this.prisma, this.prisma.rankingSnapshot, query, RANKING_SNAPSHOT_SPEC, { include: INCLUDE });
    const listIds = [...new Set(page.data.map((row) => row.rankingListId))];
    const dirty = new Map<string, number>();
    for (const listId of listIds) dirty.set(listId, (await findDirtySubEventIds(this.prisma, listId)).length);
    const publishers = await this.publishersOf(page.data.map((row) => row.publishedById));
    return {
      ...page,
      data: page.data.map((row) => ({ ...row, dirtySubEvents: dirty.get(row.rankingListId) ?? 0, publishedBy: (row.publishedById && publishers.get(row.publishedById)) || null })),
    };
  }

  /** publishedById has no FK, so a deleted user simply resolves to no name. */
  private async publishersOf(ids: (string | null)[]): Promise<Map<string, Publisher>> {
    const distinct = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!distinct.length) return new Map();
    const users = await this.prisma.user.findMany({ where: { id: { in: distinct } }, select: { id: true, name: true } });
    return new Map(users.map((user) => [user.id, user]));
  }

  async get(id: string) {
    const row = await this.prisma.rankingSnapshot.findUnique({ where: { id }, include: INCLUDE });
    if (!row) throw new NotFoundException({ code: 'RANKING_SNAPSHOT_NOT_FOUND', message: 'Không tìm thấy bản chốt' });
    const publisher = (await this.publishersOf([row.publishedById])).get(row.publishedById ?? '') ?? null;
    return { ...row, dirtySubEvents: (await findDirtySubEventIds(this.prisma, row.rankingListId)).length, publishedBy: publisher };
  }

  /** `filter[changed]=true` keeps players whose rank moved, plus newcomers when a previous period exists. */
  async rows(snapshotId: string, query: PaginationQueryShape) {
    const snapshot = await this.prisma.rankingSnapshot.findUnique({ where: { id: snapshotId }, select: { id: true, rankingListId: true, publishedAt: true } });
    if (!snapshot) throw new NotFoundException({ code: 'RANKING_SNAPSHOT_NOT_FOUND', message: 'Không tìm thấy bản chốt' });
    const previous = await findPreviousSnapshot(this.prisma, snapshot);
    const q = query.q;
    const contains = (field: string) => ({ [field]: { contains: q, mode: 'insensitive' as const } });
    const changed = booleanFilter('changed')(query.filter.changed ?? 'false').changed === true;
    const where = {
      snapshotId,
      ...(q && { player: { OR: [contains('fullName'), contains('code'), contains('club')] } }),
      ...(changed && { OR: [{ movement: { not: 0 } }, ...(previous ? [{ previousRank: null }] : [])] }),
    };
    const sort = query.sort ?? { field: 'rank', direction: 'asc' as const };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.rankingSnapshotRow.findMany({
        where,
        orderBy: [{ [sort.field]: sort.direction }, { playerId: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { player: { select: { id: true, code: true, slug: true, fullName: true, countryCode: true, club: true } } },
      }),
      this.prisma.rankingSnapshotRow.count({ where }),
    ]);
    const before = await this.pointsIn(previous?.id, data.map((row) => row.playerId));
    return toPaginatedResult(data.map((row) => ({ ...row, previousPoints: before.get(row.playerId) ?? null })), total, query);
  }

  private async pointsIn(snapshotId: string | undefined, playerIds: string[]): Promise<Map<string, number>> {
    if (!snapshotId || !playerIds.length) return new Map();
    const found = await this.prisma.rankingSnapshotRow.findMany({ where: { snapshotId, playerId: { in: playerIds } }, select: { playerId: true, points: true } });
    return new Map(found.map((row) => [row.playerId, row.points]));
  }
}

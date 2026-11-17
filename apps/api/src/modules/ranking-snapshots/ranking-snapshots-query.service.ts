import { Injectable, NotFoundException } from '@nestjs/common';
import { findDirtySubEventIds } from '@kamito/db';
import type { PaginationQueryShape } from '@kamito/shared';
import { enumFilter, idFilter, prismaListQuery } from '../../common/crud/prisma-list-query.js';
import { toPaginatedResult } from '../../common/pagination/pagination-query.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const RANKING_SNAPSHOT_SPEC = {
  sortable: ['asOfDate', 'createdAt', 'publishedAt'],
  defaultSort: { field: 'asOfDate', direction: 'desc' },
  filters: { listId: idFilter('rankingListId'), status: enumFilter('status', ['DRAFT', 'PUBLISHED']) },
} as const;

export const RANKING_ROWS_RULES = { sortable: ['rank', 'points', 'movement', 'resultsCounted'] } as const;

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

  async rows(snapshotId: string, query: PaginationQueryShape) {
    const exists = await this.prisma.rankingSnapshot.findUnique({ where: { id: snapshotId }, select: { id: true } });
    if (!exists) throw new NotFoundException({ code: 'RANKING_SNAPSHOT_NOT_FOUND', message: 'Không tìm thấy bản chốt' });
    const q = query.q;
    const where = {
      snapshotId,
      ...(q && { player: { OR: [{ fullName: { contains: q, mode: 'insensitive' as const } }, { code: { contains: q, mode: 'insensitive' as const } }] } }),
    };
    const sort = query.sort ?? { field: 'rank', direction: 'asc' as const };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.rankingSnapshotRow.findMany({
        where,
        orderBy: [{ [sort.field]: sort.direction }, { playerId: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { player: { select: { id: true, code: true, slug: true, fullName: true, countryCode: true } } },
      }),
      this.prisma.rankingSnapshotRow.count({ where }),
    ]);
    return toPaginatedResult(data, total, query);
  }
}

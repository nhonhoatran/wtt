import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import { normalizePersonName, type PaginationQueryShape } from '@kamito/shared';
import { buildListWhere, enumFilter, type ListSpec } from '../../common/crud/prisma-list-query.js';
import { toPaginatedResult } from '../../common/pagination/pagination-query.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ENTRY_INCLUDE, toEntryView } from './entry-view.js';

export const ENTRY_LIST_SPEC = {
  sortable: ['seed', 'createdAt', 'displayName'],
  defaultSort: { field: 'seed', direction: 'asc' },
  filters: {
    status: enumFilter('status', ['CONFIRMED', 'WITHDRAWN']),
    stage: enumFilter('stage', ['MAIN', 'QUALIFYING']),
    quotaType: enumFilter('quotaType', ['DIRECT', 'WILDCARD', 'QUALIFIER']),
  },
} satisfies ListSpec;

function orderBy(sort: PaginationQueryShape['sort']): Prisma.EntryOrderByWithRelationInput[] {
  const { field, direction } = sort ?? ENTRY_LIST_SPEC.defaultSort;
  const primary: Prisma.EntryOrderByWithRelationInput =
    field === 'displayName'
      ? { competitor: { displayName: direction } }
      : field === 'seed'
        ? { seed: { sort: direction, nulls: 'last' } }
        : { createdAt: direction };
  return [primary, { createdAt: 'asc' }, { id: 'asc' }];
}

/** Matches the competitor name as typed, or any member's accent-free name. */
function searchWhere(q: string): Prisma.EntryWhereInput {
  const normalized = normalizePersonName(q);
  const member: Prisma.PlayerWhereInput = { normalizedName: { contains: normalized } };
  return {
    OR: [
      { competitor: { displayName: { contains: q, mode: 'insensitive' } } },
      { competitor: { player: member } },
      { competitor: { pair: { OR: [{ playerA: member }, { playerB: member }] } } },
    ],
  };
}

@Injectable()
export class EntriesQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(subEventId: string, query: PaginationQueryShape) {
    await this.requireSubEvent(subEventId);
    const baseWhere: Prisma.EntryWhereInput = { subEventId, ...(query.q && searchWhere(query.q)) };
    const where = buildListWhere({ ...query, q: undefined }, ENTRY_LIST_SPEC, baseWhere) as Prisma.EntryWhereInput;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.entry.findMany({ where, orderBy: orderBy(query.sort), skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: ENTRY_INCLUDE }),
      this.prisma.entry.count({ where }),
    ]);
    return toPaginatedResult(rows.map(toEntryView), total, query);
  }

  async countsByEvent(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    const [subEvents, groups] = await Promise.all([
      this.prisma.subEvent.findMany({ where: { eventId }, select: { id: true }, orderBy: [{ order: 'asc' }, { code: 'asc' }] }),
      this.prisma.entry.groupBy({ by: ['subEventId', 'status'], where: { subEvent: { eventId } }, _count: { _all: true } }),
    ]);
    return subEvents.map(({ id }) => {
      const count = (status: string) => groups.find((group) => group.subEventId === id && group.status === status)?._count._all ?? 0;
      return { subEventId: id, confirmed: count('CONFIRMED'), withdrawn: count('WITHDRAWN') };
    });
  }

  private async requireSubEvent(id: string) {
    const row = await this.prisma.subEvent.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException({ code: 'SUB_EVENT_NOT_FOUND', message: 'Không tìm thấy nội dung thi đấu' });
  }
}

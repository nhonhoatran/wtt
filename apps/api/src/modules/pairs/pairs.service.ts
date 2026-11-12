import { Injectable } from '@nestjs/common';
import type { PaginationQueryShape } from '@kamito/shared';
import { normalizePersonName } from '@kamito/shared';
import type { Prisma } from '@kamito/db';
import { prismaListQuery, type ListDelegate, type ListSpec } from '../../common/crud/prisma-list-query.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const PAIR_LIST_SPEC = {
  sortable: ['createdAt'],
  defaultSort: { field: 'createdAt', direction: 'desc' },
} satisfies ListSpec;

const PLAYER_REF = { select: { id: true, code: true, fullName: true } } as const;
const PAIR_INCLUDE = {
  playerA: PLAYER_REF,
  playerB: PLAYER_REF,
  competitor: { select: { id: true, _count: { select: { entries: true } } } },
} satisfies Prisma.PairInclude;

type PairRow = Prisma.PairGetPayload<{ include: typeof PAIR_INCLUDE }>;

function playerMatches(q: string): Prisma.PlayerWhereInput {
  return { OR: [{ normalizedName: { contains: normalizePersonName(q) } }, { code: { contains: q.trim(), mode: 'insensitive' } }] };
}

@Injectable()
export class PairsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryShape) {
    const baseWhere: Prisma.PairWhereInput = query.q ? { OR: [{ playerA: playerMatches(query.q) }, { playerB: playerMatches(query.q) }] } : {};
    const page = await prismaListQuery<PairRow>(this.prisma, this.prisma.pair as unknown as ListDelegate<PairRow>, { ...query, q: undefined }, PAIR_LIST_SPEC, {
      baseWhere,
      include: PAIR_INCLUDE,
    });
    return {
      ...page,
      data: page.data.map((pair) => ({
        id: pair.id,
        competitorId: pair.competitor?.id ?? null,
        playerA: pair.playerA,
        playerB: pair.playerB,
        entryCount: pair.competitor?._count.entries ?? 0,
        createdAt: pair.createdAt,
      })),
    };
  }
}

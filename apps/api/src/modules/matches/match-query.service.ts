import { Injectable } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { MATCH_VIEW_INCLUDE, toMatchView } from './match-view.js';

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
}

import { Injectable } from '@nestjs/common';
import type { PublicGroups } from '@kamito/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicScope } from '../public-scope/public-scope.js';
import { PUBLIC_SIDE_SELECT } from './public-bracket.query.js';
import { subEventNames, toSide } from './public-bracket.serializer.js';
import { PUBLIC_MATCH_CARD_SELECT, toPublicMatchCard } from './public-match.serializer.js';

const NAMED = { select: { name: true, nameEn: true } } as const;

@Injectable()
export class PublicGroupsQuery {
  constructor(private readonly prisma: PrismaService) {}

  /** Two queries: the sub-event with its published group draw (groups + standings), then the group matches. */
  async groups(slug: string, subEventCode: string): Promise<PublicGroups | null> {
    const subEvent = await this.prisma.subEvent.findFirst({
      where: { code: subEventCode, event: publicScope.event(slug) },
      select: {
        code: true,
        name: true,
        nameEn: true,
        discipline: NAMED,
        category: NAMED,
        event: { select: { slug: true, name: true, nameEn: true, timezone: true } },
        draws: {
          where: { ...publicScope.draw, kind: 'GROUP' },
          select: {
            id: true,
            groups: {
              orderBy: [{ order: 'asc' }, { code: 'asc' }],
              select: {
                code: true,
                standings: {
                  select: {
                    rank: true,
                    manualRank: true,
                    played: true,
                    won: true,
                    lost: true,
                    matchPoints: true,
                    gamesFor: true,
                    gamesAgainst: true,
                    qualified: true,
                    entry: PUBLIC_SIDE_SELECT,
                  },
                },
              },
            },
          },
        },
      },
    });
    const draw = subEvent?.draws[0];
    if (!subEvent || !draw) return null;

    const matches = await this.prisma.match.findMany({
      where: { ...publicScope.match(slug), drawId: draw.id, groupId: { not: null } },
      select: PUBLIC_MATCH_CARD_SELECT,
      orderBy: [{ round: { number: 'asc' } }, { orderInRound: 'asc' }],
    });
    const cards = matches.map(toPublicMatchCard);

    return {
      event: subEvent.event,
      subEvent: { code: subEvent.code, ...subEventNames(subEvent) },
      groups: draw.groups.map((group) => ({
        code: group.code,
        standings: group.standings
          .map((s) => ({
            rank: s.manualRank ?? s.rank,
            side: toSide(s.entry)!,
            played: s.played,
            won: s.won,
            lost: s.lost,
            matchPoints: s.matchPoints,
            gamesFor: s.gamesFor,
            gamesAgainst: s.gamesAgainst,
            qualified: s.qualified,
          }))
          .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER)),
        matches: cards.filter((m) => m.groupCode === group.code),
      })),
    };
  }
}

import { Injectable } from '@nestjs/common';
import type { PublicEventRankingPoints } from '@kamito/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicScope } from '../public-scope/public-scope.js';
import { dateOnly } from '../public-events/public-event.serializer.js';
import { subEventNames } from '../public-competition/public-bracket.serializer.js';
import { PUBLIC_RANKING_LIST_SELECT, toPublicRankingList } from './public-ranking.serializer.js';

const NAMED = { select: { name: true, nameEn: true } } as const;

@Injectable()
export class PublicEventRankingPointsQuery {
  constructor(private readonly prisma: PrismaService) {}

  async points(slug: string): Promise<PublicEventRankingPoints | null> {
    const event = await this.prisma.event.findFirst({
      where: { ...publicScope.event(slug), showInfoTab: true },
      select: {
        eventTypeId: true,
        endDate: true,
        subEvents: {
          where: { rankingList: { isActive: true } },
          orderBy: [{ order: 'asc' }, { code: 'asc' }],
          select: { code: true, name: true, nameEn: true, discipline: NAMED, category: NAMED, rankingList: { select: PUBLIC_RANKING_LIST_SELECT } },
        },
      },
    });
    if (!event) return null;
    if (!event.subEvents.length) return { items: [] };
    const rules = await this.prisma.rankingPointsRule.findMany({
      where: { eventTypeId: event.eventTypeId, effectiveFrom: { lte: event.endDate } },
      select: { competitorKind: true, drawKind: true, stageCode: true, points: true, effectiveFrom: true },
      orderBy: [{ effectiveFrom: 'desc' }, { drawKind: 'asc' }, { stageCode: 'asc' }],
    });
    const current = new Map<string, typeof rules[number]>();
    for (const rule of rules) {
      const key = `${rule.competitorKind}:${rule.drawKind}:${rule.stageCode}`;
      if (!current.has(key)) current.set(key, rule);
    }
    return { items: event.subEvents.flatMap((sub) => sub.rankingList ? [{
      subEvent: { code: sub.code, ...subEventNames(sub) },
      list: toPublicRankingList(sub.rankingList),
      rules: [...current.values()].filter((rule) => rule.competitorKind === sub.rankingList!.competitorKind).map((rule) => ({
        drawKind: rule.drawKind,
        stageCode: rule.stageCode,
        points: rule.points,
        effectiveFrom: dateOnly(rule.effectiveFrom),
      })),
    }] : []) };
  }
}

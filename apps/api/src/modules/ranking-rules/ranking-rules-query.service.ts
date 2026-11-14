import { Injectable } from '@nestjs/common';
import { ruleFor, stageCodeRows, type DrawKind, type PointsRule } from '@kamito/ranking-engine';
import { toIsoDate } from '../../common/validation/iso-date-field.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { findAffectedSubEvents, type RuleImpactInput } from './ranking-rules-impact.js';

export interface MatrixInput {
  competitorKind: 'SINGLES' | 'DOUBLES';
  drawKind: DrawKind;
  asOf: string;
}

@Injectable()
export class RankingRulesQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Points in force on `asOf` for every (event type, stage) cell, plus the stored version dates. */
  async matrix(input: MatrixInput) {
    const [eventTypes, rows] = await Promise.all([
      this.prisma.eventType.findMany({
        select: { id: true, code: true, name: true, nameEn: true, isActive: true, tier: { select: { id: true, name: true } } },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.rankingPointsRule.findMany({ where: { competitorKind: input.competitorKind, drawKind: input.drawKind } }),
    ]);
    const rules: PointsRule[] = rows.map((row) => ({
      eventTypeId: row.eventTypeId,
      competitorKind: row.competitorKind,
      drawKind: row.drawKind,
      stageCode: row.stageCode,
      points: row.points,
      effectiveFrom: toIsoDate(row.effectiveFrom),
    }));
    const stageCodes = stageCodeRows(input.drawKind, rules.map((rule) => rule.stageCode));
    const cells = eventTypes.flatMap((eventType) =>
      stageCodes.flatMap((stageCode) => {
        const rule = ruleFor(rules, { eventTypeId: eventType.id, ...input, stageCode, endDate: input.asOf });
        return rule ? [{ eventTypeId: eventType.id, stageCode, points: rule.points, effectiveFrom: rule.effectiveFrom }] : [];
      }),
    );
    const versions = [...new Set(rules.map((rule) => rule.effectiveFrom))].sort().reverse();
    return { ...input, eventTypes, stageCodes, cells, versions };
  }

  async impact(input: RuleImpactInput) {
    const affected = await findAffectedSubEvents(this.prisma, input);
    return { subEvents: affected.length, events: new Set(affected.map((row) => row.eventId)).size };
  }
}

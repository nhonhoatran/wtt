import { Injectable } from '@nestjs/common';
import { advisoryLock } from '@kamito/db';
import { ruleFor, type PointsRule } from '@kamito/ranking-engine';
import { AuditService } from '../../common/audit/audit.service.js';
import { dateFromIso, toIsoDate } from '../../common/validation/iso-date-field.js';
import { fieldError } from '../../common/validation/parse-body.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { markRankingDirty } from '../ranking-jobs/ranking-dirty-marker.js';
import { RankingEnqueueService } from '../ranking-jobs/ranking-enqueue.service.js';
import { CACHE_TAGS } from '../revalidation/cache-tags.js';
import { RevalidationEnqueueService } from '../revalidation/revalidation-enqueue.service.js';
import type { SaveMatrixBody } from './ranking-rule-dtos.js';
import { findAffectedSubEvents } from './ranking-rules-impact.js';

const cellKey = (eventTypeId: string, stageCode: string) => `${eventTypeId}|${stageCode}`;

@Injectable()
export class RankingRulesSaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly enqueuer: RankingEnqueueService,
    private readonly revalidation: RevalidationEnqueueService,
  ) {}

  /** One save = the changed cells under one effective date; saving the same date again edits that version. */
  async save(body: SaveMatrixBody, actorUserId: string) {
    const { competitorKind, drawKind, effectiveFrom, cells } = body;
    const eventTypeIds = [...new Set(cells.map((cell) => cell.eventTypeId))];
    if (new Set(cells.map((cell) => cellKey(cell.eventTypeId, cell.stageCode))).size !== cells.length) throw fieldError('cells', 'Có ô bị trùng');

    const { recompute } = await this.prisma.$transaction(
      async (tx) => {
        await advisoryLock(tx, `ranking-rules:${competitorKind}:${drawKind}:${effectiveFrom}`);
        if ((await tx.eventType.count({ where: { id: { in: eventTypeIds } } })) !== eventTypeIds.length) throw fieldError('cells', 'Hạng giải không tồn tại');

        const stored = await tx.rankingPointsRule.findMany({ where: { eventTypeId: { in: eventTypeIds }, competitorKind, drawKind } });
        const rules: PointsRule[] = stored.map((row) => ({ ...row, effectiveFrom: toIsoDate(row.effectiveFrom) }));
        const sameVersion = new Map(stored.filter((row) => toIsoDate(row.effectiveFrom) === effectiveFrom).map((row) => [cellKey(row.eventTypeId, row.stageCode), row.id]));
        const before = cells.map((cell) => ({
          eventTypeId: cell.eventTypeId,
          stageCode: cell.stageCode,
          points: ruleFor(rules, { ...cell, competitorKind, drawKind, endDate: effectiveFrom })?.points ?? null,
        }));

        const fresh = cells.filter((cell) => !sameVersion.has(cellKey(cell.eventTypeId, cell.stageCode)));
        await tx.rankingPointsRule.createMany({
          data: fresh.map((cell) => ({ ...cell, competitorKind, drawKind, effectiveFrom: dateFromIso(effectiveFrom), createdById: actorUserId })),
        });
        for (const cell of cells) {
          const id = sameVersion.get(cellKey(cell.eventTypeId, cell.stageCode));
          if (id) await tx.rankingPointsRule.update({ where: { id }, data: { points: cell.points } });
        }

        const affected = await findAffectedSubEvents(tx, { competitorKind, effectiveFrom, eventTypeIds });
        const recomputeIds = await markRankingDirty(tx, affected.map((row) => row.id));
        await this.audit.record(
          {
            action: 'ranking.rules.save',
            entity: 'RankingPointsRule',
            entityId: `${competitorKind}:${drawKind}:${effectiveFrom}`,
            before,
            after: { effectiveFrom, cells, recomputeSubEvents: recomputeIds.length },
            reason: body.note,
          },
          tx,
        );
        return { recompute: recomputeIds };
      },
      { timeout: 60_000 },
    );

    const warnings = [
      ...(await this.enqueuer.enqueueRecompute(recompute)),
      ...(await this.revalidation.enqueue(async () => CACHE_TAGS['rankingRules.write']({
        eventSlugs: (await this.prisma.event.findMany({
          where: { eventTypeId: { in: eventTypeIds }, endDate: { gte: dateFromIso(effectiveFrom) }, subEvents: { some: { rankingListId: { not: null }, discipline: { competitorKind } } } },
          select: { slug: true },
        })).map((event) => event.slug),
      }))),
    ];
    return { data: { saved: cells.length, effectiveFrom, recomputeSubEvents: recompute.length }, ...(warnings.length > 0 && { warnings }) };
  }
}

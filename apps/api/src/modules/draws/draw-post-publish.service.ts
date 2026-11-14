import { Injectable } from '@nestjs/common';
import { isStructureLocked, lockDraw, type Draw, type Prisma } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { markRankingDirty } from '../ranking-jobs/ranking-dirty-marker.js';
import { RankingEnqueueService } from '../ranking-jobs/ranking-enqueue.service.js';
import { CACHE_TAGS } from '../revalidation/cache-tags.js';
import { RevalidationEnqueueService } from '../revalidation/revalidation-enqueue.service.js';
import type { ReplaceEntryBody, UnpublishBody, WithdrawEntryBody } from './draw-dtos.js';
import { conflict, invalid, notPublished, structureLocked } from './draw-errors.js';
import { executeOperation, type RawImpact } from './draw-impact.js';
import { bumpVersion, loadDrawLocked } from './draw-lock.js';
import { replaceEntryAtPosition } from './draw-replace-entry.js';
import { loadDrawTagContext } from './draw-tag-context.js';
import { drawAuditFields } from './draw-view.js';
import { GroupWithdrawalService } from './group-withdrawal.service.js';
import { withdrawFromKnockout } from './knockout-walkover.js';
import { releaseScheduleSlots } from '../scheduling/release-schedule-slots.js';

type Tx = Prisma.TransactionClient;

/** Operations on a PUBLISHED draw. Each needs a reason, writes one audit row and supports dryRun. */
@Injectable()
export class DrawPostPublishService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly groupWithdrawal: GroupWithdrawalService,
    private readonly revalidation: RevalidationEnqueueService,
    private readonly ranking: RankingEnqueueService,
  ) {}

  /**
   * Runs the operation, then (unless dry run) drops the draw and match pages it changed and, for result-affecting edits,
   * queues a ranking recompute. `entryIds` must be read before the edit: a replaced entry no longer sits at its position afterwards.
   */
  private async withRefresh<T extends object>(drawId: string, dryRun: boolean | undefined, mutation: 'draw.unpublish' | 'draw.postPublishEdit', entryIds: () => Promise<string[]>, run: () => Promise<T>) {
    const affected = dryRun ? [] : await entryIds();
    const result = await run();
    if (dryRun) return result;
    const warnings = await this.revalidation.enqueue(async () => CACHE_TAGS[mutation](await loadDrawTagContext(this.prisma, drawId, { matches: 'subEvent', entryIds: affected })));
    if (mutation === 'draw.postPublishEdit') {
      const draw = await this.prisma.draw.findUnique({ where: { id: drawId }, select: { subEventId: true } });
      if (draw) warnings.push(...(await this.ranking.enqueueRecompute([draw.subEventId])));
    }
    return warnings.length > 0 ? { ...result, warnings } : result;
  }

  private async openPublished(tx: Tx, drawId: string, expectedVersion: number): Promise<Draw> {
    const draw = await loadDrawLocked(tx, drawId, expectedVersion);
    if (draw.status !== 'PUBLISHED') throw notPublished();
    return draw;
  }

  private async finish(tx: Tx, draw: Draw, action: string, reason: string | undefined, impacts: RawImpact[], extra: object = {}) {
    const updated = await bumpVersion(tx, draw.id);
    await markRankingDirty(tx, [draw.subEventId]);
    await this.audit.record(
      { action, entity: 'Draw', entityId: draw.id, reason, before: drawAuditFields(draw), after: { version: updated.version, ...extra, impacts } },
      tx,
    );
    return { draw: updated, impacts };
  }

  unpublish(drawId: string, body: UnpublishBody) {
    return this.withRefresh(drawId, body.dryRun, 'draw.unpublish', async () => [], () => executeOperation(this.prisma, body.dryRun, async (tx) => {
      const draw = await this.openPublished(tx, drawId, body.expectedVersion);
      if (await isStructureLocked(tx, drawId)) throw structureLocked();
      if (draw.kind === 'GROUP' && (await tx.draw.count({ where: { subEventId: draw.subEventId, kind: 'MAIN' } }))) {
        throw conflict('DEPENDENT_DRAW_EXISTS', 'Nhánh chính đã được tạo từ các bảng này. Xóa nhánh chính trước khi bỏ công bố vòng bảng');
      }
      const impacts: RawImpact[] = [{ type: 'UNPUBLISH' }];
      const updated = await bumpVersion(tx, drawId, { status: 'DRAFT', publishedAt: null });
      await releaseScheduleSlots(tx, { drawId });
      await this.audit.record(
        {
          action: 'draw.unpublish',
          entity: 'Draw',
          entityId: drawId,
          reason: body.reason,
          before: drawAuditFields(draw),
          after: { status: 'DRAFT', version: updated.version, impacts },
        },
        tx,
      );
      return { draw: updated, impacts };
    }));
  }

  replaceEntry(drawId: string, body: ReplaceEntryBody) {
    const affected = async () => {
      const position = await this.prisma.bracketPosition.findFirst({ where: { id: body.positionId, drawId }, select: { entryId: true } });
      return position?.entryId ? [position.entryId, body.newEntryId] : [body.newEntryId];
    };
    return this.withRefresh(drawId, body.dryRun, 'draw.postPublishEdit', affected, () => executeOperation(this.prisma, body.dryRun, async (tx) => {
      const draw = await this.openPublished(tx, drawId, body.expectedVersion);
      if (draw.kind === 'GROUP') throw invalid('KIND_NOT_ALLOWED', 'Vòng bảng không có vị trí để thay VĐV');
      const impacts = await replaceEntryAtPosition(tx, draw, body.positionId, body.newEntryId);
      return this.finish(tx, draw, 'draw.replaceEntry', body.reason, impacts, { positionId: body.positionId, newEntryId: body.newEntryId });
    }));
  }

  withdrawEntry(drawId: string, body: WithdrawEntryBody) {
    return this.withRefresh(drawId, body.dryRun, 'draw.postPublishEdit', async () => [body.entryId], () => executeOperation(this.prisma, body.dryRun, async (tx) => {
      const draw = await this.openPublished(tx, drawId, body.expectedVersion);
      const entry = await tx.entry.findUnique({ where: { id: body.entryId }, select: { status: true, subEventId: true } });
      if (!entry || entry.subEventId !== draw.subEventId) throw invalid('ENTRY_NOT_IN_DRAW', 'VĐV không nằm trong nhánh này');
      if (entry.status === 'WITHDRAWN' && !(await hasUnfinishedMatches(tx, draw.id, body.entryId))) {
        throw conflict('ENTRY_ALREADY_WITHDRAWN', 'VĐV này đã rút');
      }

      await tx.entry.update({ where: { id: body.entryId }, data: { status: 'WITHDRAWN', seed: null } });
      const impacts = await this.withdrawFromDraw(tx, draw, body.entryId);
      if (draw.kind === 'QUALIFYING') impacts.push(...(await this.cascadeToMain(tx, draw, body.entryId)));
      return this.finish(tx, draw, 'draw.withdrawEntry', body.reason, impacts, { entryId: body.entryId });
    }));
  }

  private withdrawFromDraw(tx: Tx, draw: Draw, entryId: string): Promise<RawImpact[]> {
    return draw.kind === 'GROUP' ? this.groupWithdrawal.withdraw(tx, draw, entryId) : withdrawFromKnockout(tx, draw, entryId);
  }

  /**
   * A qualifier already placed in the published MAIN draw leaves it in the same transaction. The extra
   * draw is locked after the first one; every writer takes the SubEvent lock first, so the order cannot cycle.
   */
  private async cascadeToMain(tx: Tx, qualifying: Draw, entryId: string): Promise<RawImpact[]> {
    const main = await tx.draw.findUnique({ where: { subEventId_kind: { subEventId: qualifying.subEventId, kind: 'MAIN' } } });
    if (!main || main.status !== 'PUBLISHED' || !(await tx.bracketPosition.count({ where: { drawId: main.id, entryId } }))) return [];
    await lockDraw(tx, main.id);
    const impacts = await withdrawFromKnockout(tx, main, entryId);
    await bumpVersion(tx, main.id);
    return impacts;
  }
}

/** Matches still to be settled for the entry: unfinished, not voided and not already a pending walkover. */
async function hasUnfinishedMatches(tx: Tx, drawId: string, entryId: string): Promise<boolean> {
  const count = await tx.match.count({
    where: {
      drawId,
      isVoided: false,
      status: { not: 'OFFICIAL' },
      AND: [{ OR: [{ side1EntryId: entryId }, { side2EntryId: entryId }] }, { OR: [{ resultType: null }, { resultType: { not: 'WALKOVER' } }] }],
    },
  });
  return count > 0;
}

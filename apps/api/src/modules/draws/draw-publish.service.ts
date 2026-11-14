import { Injectable } from '@nestjs/common';
import { isStructureLocked } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { markRankingDirty } from '../ranking-jobs/ranking-dirty-marker.js';
import { RankingEnqueueService } from '../ranking-jobs/ranking-enqueue.service.js';
import { CACHE_TAGS } from '../revalidation/cache-tags.js';
import { RevalidationEnqueueService } from '../revalidation/revalidation-enqueue.service.js';
import { loadDrawTagContext } from './draw-tag-context.js';
import { alreadyPublished, conflict, notDraft, structureLocked } from './draw-errors.js';
import { bumpVersion, loadDrawLocked } from './draw-lock.js';
import { assertNoStaleEntries } from './draw-stale-entries.js';
import { settlePendingWalkovers } from './knockout-walkover.js';
import { drawAuditFields, toDrawSummary } from './draw-view.js';

@Injectable()
export class DrawPublishService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly revalidation: RevalidationEnqueueService,
    private readonly ranking: RankingEnqueueService,
  ) {}

  async publish(drawId: string, expectedVersion: number) {
    const { result, context, rankingDirty } = await this.prisma.$transaction(async (tx) => {
      const draw = await loadDrawLocked(tx, drawId, expectedVersion);
      if (draw.status === 'PUBLISHED') throw alreadyPublished();
      const structure = await tx.round.count({ where: { drawId } });
      if (!structure) throw conflict('DRAW_EMPTY', 'Nhánh chưa có cấu trúc để công bố');
      await assertNoStaleEntries(tx, draw);
      const pendingWalkovers = await tx.match.count({ where: { drawId, resultType: 'WALKOVER', status: 'SCHEDULED' } });
      await settlePendingWalkovers(tx, drawId);
      const rankingDirty = pendingWalkovers > 0 ? await markRankingDirty(tx, [draw.subEventId]) : [];
      const updated = await bumpVersion(tx, drawId, { status: 'PUBLISHED', publishedAt: new Date() });
      await this.audit.record(
        { action: 'draw.publish', entity: 'Draw', entityId: drawId, before: drawAuditFields(draw), after: { status: 'PUBLISHED', version: updated.version } },
        tx,
      );
      const context = await loadDrawTagContext(tx, drawId, { matches: 'draw' });
      return { result: { data: toDrawSummary(updated, await isStructureLocked(tx, drawId)) }, context, rankingDirty };
    });
    const warnings = [...(await this.revalidation.enqueue(() => CACHE_TAGS['draw.publish'](context))), ...(await this.ranking.enqueueRecompute(rankingDirty))];
    return { ...result, ...(warnings.length > 0 && { warnings }) };
  }

  async remove(drawId: string, expectedVersion: number) {
    return this.prisma.$transaction(async (tx) => {
      const draw = await loadDrawLocked(tx, drawId, expectedVersion);
      if (draw.status !== 'DRAFT') throw notDraft();
      if (await isStructureLocked(tx, drawId)) throw structureLocked();
      await this.audit.record({ action: 'draw.delete', entity: 'Draw', entityId: drawId, before: drawAuditFields(draw) }, tx);
      await tx.draw.delete({ where: { id: drawId } });
      return { data: { id: drawId, deleted: true } };
    });
  }
}

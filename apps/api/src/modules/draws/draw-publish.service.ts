import { Injectable } from '@nestjs/common';
import { isStructureLocked } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
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
  ) {}

  // No public cache revalidation yet: there is no revalidation module (cache-tags) in the API.
  async publish(drawId: string, expectedVersion: number) {
    return this.prisma.$transaction(async (tx) => {
      const draw = await loadDrawLocked(tx, drawId, expectedVersion);
      if (draw.status === 'PUBLISHED') throw alreadyPublished();
      const structure = await tx.round.count({ where: { drawId } });
      if (!structure) throw conflict('DRAW_EMPTY', 'Nhánh chưa có cấu trúc để công bố');
      await assertNoStaleEntries(tx, draw);
      await settlePendingWalkovers(tx, drawId);
      const updated = await bumpVersion(tx, drawId, { status: 'PUBLISHED', publishedAt: new Date() });
      await this.audit.record(
        { action: 'draw.publish', entity: 'Draw', entityId: drawId, before: drawAuditFields(draw), after: { status: 'PUBLISHED', version: updated.version } },
        tx,
      );
      return { data: toDrawSummary(updated, await isStructureLocked(tx, drawId)) };
    });
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

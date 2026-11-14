import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { markRankingDirty } from './ranking-dirty-marker.js';
import { RankingEnqueueService } from './ranking-enqueue.service.js';

export type RecomputeTarget = { subEventId: string } | { eventTypeId: string };

/** Admin-triggered recompute: mark dirty in a transaction, then enqueue after commit. */
@Injectable()
export class RankingRecomputeRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly enqueuer: RankingEnqueueService,
  ) {}

  async request(target: RecomputeTarget) {
    const bySubEvent = 'subEventId' in target;
    const subEventIds = await this.prisma.$transaction(
      async (tx) => {
        const found = await tx.subEvent.findMany({
          where: bySubEvent
            ? { id: target.subEventId }
            : { event: { eventTypeId: target.eventTypeId }, OR: [{ rankingListId: { not: null } }, { rankingPoints: { some: { source: 'AUTO' } } }] },
          select: { id: true },
        });
        if (bySubEvent && !found.length) throw new NotFoundException({ code: 'SUB_EVENT_NOT_FOUND', message: 'Không tìm thấy nội dung thi đấu' });
        const ids = await markRankingDirty(tx, found.map((row) => row.id));
        await this.audit.record(
          {
            action: 'ranking.recompute',
            entity: bySubEvent ? 'SubEvent' : 'EventType',
            entityId: bySubEvent ? target.subEventId : target.eventTypeId,
            after: { subEvents: ids.length },
          },
          tx,
        );
        return ids;
      },
      { timeout: 30_000 },
    );
    const warnings = await this.enqueuer.enqueueRecompute(subEventIds);
    return { data: { subEventIds }, ...(warnings.length > 0 && { warnings }) };
  }
}

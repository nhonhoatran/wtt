import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service.js';
import { fieldError } from '../../common/validation/parse-body.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CACHE_TAGS } from '../revalidation/cache-tags.js';
import { RevalidationEnqueueService } from '../revalidation/revalidation-enqueue.service.js';
import { planSponsorOrder, type reorderSponsorsBody } from './sponsor-order.js';

@Injectable()
export class SponsorOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly revalidation: RevalidationEnqueueService,
  ) {}

  async reorder(input: z.infer<typeof reorderSponsorsBody>) {
    const changedIds = await this.prisma.$transaction(async (tx) => {
      const scopeId = input.eventId ?? 'site-wide';
      const lock = `cms-sponsor-order:${scopeId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lock}))`;
      const rows = await tx.sponsor.findMany({
        where: { eventId: input.eventId }, select: { id: true, order: true },
        orderBy: [{ order: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      });
      let changes;
      try { changes = planSponsorOrder(rows, input.orderedIds); }
      catch (error) {
        if (error instanceof RangeError) throw fieldError('orderedIds', error.message, 'INVALID_SPONSOR_ORDER');
        throw error;
      }
      for (const { id, order } of changes) await tx.sponsor.update({ where: { id }, data: { order } });
      if (changes.length) await this.audit.record({
        action: 'sponsor.reorder', entity: 'Sponsor', entityId: scopeId,
        before: { eventId: input.eventId, orders: changes.map(({ id, beforeOrder }) => ({ id, order: beforeOrder })) },
        after: { eventId: input.eventId, orders: changes.map(({ id, order }) => ({ id, order })) },
      }, tx);
      return changes.map(({ id }) => id);
    });
    const warnings = changedIds.length ? await this.revalidation.enqueue(() => CACHE_TAGS['content.write']()) : [];
    return { data: { changedIds }, ...(warnings.length > 0 && { warnings }) };
  }
}

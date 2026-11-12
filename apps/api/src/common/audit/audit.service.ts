import { Injectable } from '@nestjs/common';
import { AuditActorType, Prisma } from '@kamito/db';
import { PrismaService } from '../../modules/prisma/prisma.service.js';
import { maskPii } from './mask-pii.js';
import { getRequestContext } from './request-context.js';

export const SYSTEM_ACTOR_ID = 'system';

export interface AuditEntry {
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  /** Omit for system jobs/CLI; then the actor is "system". */
  actorUserId?: string;
}

type AuditWriter = Pick<Prisma.TransactionClient, 'auditLog'>;

const toJson = (value: unknown) =>
  value === undefined ? undefined : (maskPii(value) as Prisma.InputJsonValue);

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pass a transaction client to keep the audit row atomic with the change. */
  async record(entry: AuditEntry, tx: AuditWriter = this.prisma): Promise<void> {
    const context = getRequestContext();
    const userId = entry.actorUserId ?? context?.userId;
    await tx.auditLog.create({
      data: {
        actorType: userId ? AuditActorType.USER : AuditActorType.SYSTEM,
        actorId: userId ?? SYSTEM_ACTOR_ID,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: toJson(entry.before),
        after: toJson(entry.after),
        reason: entry.reason,
        ip: context?.ip,
        userAgent: context?.userAgent,
        sessionId: context?.sessionId,
        requestId: context?.requestId,
      },
    });
  }
}

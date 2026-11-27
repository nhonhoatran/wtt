import { ConflictException, HttpException, Injectable } from '@nestjs/common';
import { lockSubEventsInOrder, Prisma } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CACHE_TAGS } from '../revalidation/cache-tags.js';
import { RevalidationEnqueueService } from '../revalidation/revalidation-enqueue.service.js';
import { loadAutoSchedule } from './auto-schedule-data.js';
import { isAutoScheduleWriteConflict } from './auto-schedule-conflict.js';
import type { AutoScheduleApplyBody, AutoSchedulePreviewBody } from './auto-schedule-dtos.js';
import { planAutoSchedule } from './auto-schedule-engine.js';
import { lockSessionsInOrder } from './schedule-locks.js';
import { loadScheduleTagContext } from './schedule-tag-context.js';
import { SCHEDULE_TX_TIMEOUT_MS } from './schedule-tx.js';

const stale = () => new ConflictException({ code: 'AUTO_SCHEDULE_STALE', message: 'Dữ liệu hoặc lịch đã thay đổi. Xem gợi ý mới trước khi áp dụng.' });
type Tx = Prisma.TransactionClient;

@Injectable()
export class AutoScheduleService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly revalidation: RevalidationEnqueueService) {}

  async preview(eventId: string, body: AutoSchedulePreviewBody) {
    const input = await loadAutoSchedule(this.prisma, eventId, body.sessionIds);
    return { data: { ...planAutoSchedule(input.matches, input.sessions, input.minRest, input.cap), fingerprint: input.fingerprint, timeZone: input.timeZone, minRestMinutes: input.minRest } };
  }

  async apply(eventId: string, body: AutoScheduleApplyBody) {
    let plan;
    try {
      plan = await this.prisma.$transaction(async (tx) => {
        await this.lock(tx, eventId);
        const input = await loadAutoSchedule(tx, eventId, body.sessionIds).catch((error: unknown) => {
          if (error instanceof HttpException && [404, 422].includes(error.getStatus())) throw stale();
          throw error;
        });
        if (input.fingerprint !== body.expectedFingerprint) throw stale();
        const proposed = planAutoSchedule(input.matches, input.sessions, input.minRest, input.cap);
        for (const a of proposed.assignments) {
          await tx.match.update({ where: { id: a.matchId }, data: { sessionId: a.sessionId, tableId: a.tableId, orderInSession: a.orderInSession, scheduledAt: new Date(a.scheduledAt), scheduleVersion: { increment: 1 } } });
          await this.audit.record({ action: 'match.schedule', entity: 'Match', entityId: a.matchId, before: { sessionId: null }, after: { ...a, automatic: true } }, tx);
        }
        return proposed;
      }, { timeout: SCHEDULE_TX_TIMEOUT_MS, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (isAutoScheduleWriteConflict(error)) throw stale();
      throw error;
    }
    const warnings = plan.assignments.length ? await this.revalidation.enqueue(async () => CACHE_TAGS['schedule.update'](await loadScheduleTagContext(this.prisma, eventId, plan.assignments.map((a) => a.matchNo)))) : [];
    return { data: plan, ...(warnings.length > 0 && { warnings }) };
  }

  private async lock(tx: Tx, eventId: string) {
    // Same order as result/manual schedule writers: SubEvent -> Draw -> Session -> Match.
    const subEvents = await tx.subEvent.findMany({ where: { eventId }, select: { id: true } });
    await lockSubEventsInOrder(tx, subEvents.map((s) => s.id));
    await tx.$queryRaw`SELECT "id" FROM "Draw" WHERE "subEventId" IN (SELECT "id" FROM "SubEvent" WHERE "eventId" = ${eventId}) ORDER BY "id" FOR UPDATE`;
    const sessions = await tx.eventSession.findMany({ where: { eventId }, select: { id: true } });
    await lockSessionsInOrder(tx, sessions.map((s) => s.id));
    await tx.$queryRaw`SELECT "id" FROM "Match" WHERE "eventId" = ${eventId} ORDER BY "id" FOR UPDATE`;
  }
}

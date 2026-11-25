import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { fieldError } from '../../common/validation/parse-body.js';
import { formatDateOnly, parseDateOnly } from '../events/date-only.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CACHE_TAGS, type CacheTagMutation } from '../revalidation/cache-tags.js';
import { RevalidationEnqueueService } from '../revalidation/revalidation-enqueue.service.js';
import { lockScheduleScope, lockSessionsInOrder } from '../scheduling/schedule-locks.js';
import { loadScheduleTagContext } from '../scheduling/schedule-tag-context.js';
import { SCHEDULE_TX_TIMEOUT_MS } from '../scheduling/schedule-tx.js';
import { recomputeSessionTimes } from '../scheduling/session-timeline.js';
import { sessionMatchNosToRefresh, sessionRelabeled } from './session-affected-matches.js';
import type { CreateSessionBody, UpdateSessionBody } from './session-dtos.js';
import { instantToHhmm, zonedTimeToInstant } from './session-time.js';
import { SESSION_INCLUDE, toSessionView } from './session-view.js';

type Tx = Prisma.TransactionClient;
type SessionMutation = Extract<CacheTagMutation, `session.${string}`>;

interface EventRow {
  id: string;
  slug: string;
  timezone: string;
  venueId: string | null;
  startDate: Date;
  endDate: Date;
}

interface Effective {
  date: string;
  startTime: string;
  endTime: string | null;
  venueId: string | null;
  tableIds: string[];
}

const sessionNotFound = () => new NotFoundException({ code: 'SESSION_NOT_FOUND', message: 'Không tìm thấy buổi thi đấu' });

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly revalidation: RevalidationEnqueueService,
  ) {}

  async list(eventId: string) {
    const event = await this.requireEvent(eventId);
    const rows = await this.prisma.eventSession.findMany({ where: { eventId }, orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { code: 'asc' }], include: SESSION_INCLUDE });
    const data = rows.map((row) => toSessionView(row, event.timezone));
    return { data, total: data.length, page: 1, pageSize: data.length };
  }

  async create(eventId: string, body: CreateSessionBody) {
    const event = await this.requireEvent(eventId);
    const effective: Effective = { date: body.date, startTime: body.startTime, endTime: body.endTime ?? null, venueId: body.venueId === undefined ? event.venueId : body.venueId, tableIds: body.tableIds };
    await this.assertValid(this.prisma, event, effective, effective.tableIds);
    try {
      const view = await this.prisma.$transaction(async (tx) => {
        const row = await tx.eventSession.create({
          data: {
            eventId,
            venueId: effective.venueId,
            date: parseDateOnly(effective.date),
            code: body.code,
            name: body.name,
            nameEn: body.nameEn,
            startTime: zonedTimeToInstant(effective.date, effective.startTime, event.timezone),
            endTime: effective.endTime ? zonedTimeToInstant(effective.date, effective.endTime, event.timezone) : null,
            tables: { create: effective.tableIds.map((tableId, order) => ({ tableId, order })) },
          },
          include: SESSION_INCLUDE,
        });
        await this.audit.record({ action: 'session.create', entity: 'EventSession', entityId: row.id, after: { eventId, ...effective, code: row.code } }, tx);
        return toSessionView(row, event.timezone);
      });
      return this.withRefresh({ data: view }, 'session.create', event, []);
    } catch (error) {
      throw mapDuplicateCode(error, body.code);
    }
  }

  async update(eventId: string, id: string, body: UpdateSessionBody) {
    const event = await this.requireEvent(eventId);
    try {
      const { view, affected } = await this.prisma.$transaction(async (tx) => {
        await lockScheduleScope(tx, { sessionIds: [id] });
        const current = await tx.eventSession.findFirst({ where: { id, eventId }, include: SESSION_INCLUDE });
        if (!current) throw sessionNotFound();
        const currentTableIds = current.tables.map((t) => t.table.id);
        const effective: Effective = {
          date: body.date ?? formatDateOnly(current.date),
          startTime: body.startTime ?? instantToHhmm(current.startTime, event.timezone),
          endTime: body.endTime === undefined ? (current.endTime ? instantToHhmm(current.endTime, event.timezone) : null) : body.endTime,
          venueId: body.venueId === undefined ? current.venueId : body.venueId,
          tableIds: body.tableIds ?? currentTableIds,
        };
        await this.assertValid(tx, event, effective, effective.tableIds.filter((tid) => !currentTableIds.includes(tid)));
        await this.assertRemovedTablesFree(tx, id, currentTableIds, effective.tableIds);

        const row = await tx.eventSession.update({
          where: { id },
          data: {
            venueId: effective.venueId,
            date: parseDateOnly(effective.date),
            ...(body.code !== undefined && { code: body.code }),
            ...(body.name !== undefined && { name: body.name }),
            ...(body.nameEn !== undefined && { nameEn: body.nameEn }),
            startTime: zonedTimeToInstant(effective.date, effective.startTime, event.timezone),
            endTime: effective.endTime ? zonedTimeToInstant(effective.date, effective.endTime, event.timezone) : null,
          },
        });
        if (body.tableIds) {
          await tx.eventSessionTable.deleteMany({ where: { sessionId: id } });
          await tx.eventSessionTable.createMany({ data: effective.tableIds.map((tableId, order) => ({ sessionId: id, tableId, order })) });
        }
        const retimed = await recomputeSessionTimes(tx, id);
        const affected = await sessionMatchNosToRefresh(tx, id, sessionRelabeled(current, row), retimed);
        const fresh = await tx.eventSession.findUniqueOrThrow({ where: { id }, include: SESSION_INCLUDE });
        await this.audit.record(
          {
            action: 'session.update',
            entity: 'EventSession',
            entityId: id,
            before: { date: formatDateOnly(current.date), code: current.code, venueId: current.venueId, startsAt: current.startTime, tableIds: currentTableIds },
            after: { date: effective.date, code: row.code, venueId: effective.venueId, startsAt: row.startTime, tableIds: effective.tableIds },
          },
          tx,
        );
        return { view: toSessionView(fresh, event.timezone), affected };
      }, { timeout: SCHEDULE_TX_TIMEOUT_MS });
      return this.withRefresh({ data: view }, 'session.update', event, affected);
    } catch (error) {
      throw mapDuplicateCode(error, body.code);
    }
  }

  /** Refuses while any match (even a finished one) still points at the session: unscheduling is the explicit, audited way out. */
  async remove(eventId: string, id: string) {
    const event = await this.requireEvent(eventId);
    await this.prisma.$transaction(async (tx) => {
      await lockSessionsInOrder(tx, [id]);
      const current = await tx.eventSession.findFirst({ where: { id, eventId }, select: { code: true, date: true } });
      if (!current) throw sessionNotFound();
      const matchCount = await tx.match.count({ where: { sessionId: id } });
      if (matchCount > 0) {
        throw new ConflictException({ code: 'SESSION_HAS_MATCHES', message: `Buổi còn ${matchCount} trận đã xếp, hãy bỏ xếp các trận trước khi xóa`, dependants: { matches: matchCount } });
      }
      await tx.eventSession.delete({ where: { id } });
      await this.audit.record({ action: 'session.delete', entity: 'EventSession', entityId: id, before: { eventId, code: current.code, date: formatDateOnly(current.date) } }, tx);
    });
    return this.withRefresh({ data: { id } }, 'session.delete', event, []);
  }

  private async assertValid(db: Pick<Tx, 'venueTable'>, event: EventRow, e: Effective, newTableIds: string[]) {
    if (e.date < formatDateOnly(event.startDate) || e.date > formatDateOnly(event.endDate)) throw fieldError('date', 'Ngày nằm ngoài thời gian của giải');
    if (e.endTime !== null && e.endTime <= e.startTime) throw fieldError('endTime', 'Giờ kết thúc phải sau giờ bắt đầu');
    if (e.tableIds.length === 0) return;
    if (!e.venueId) throw fieldError('venueId', 'Chọn địa điểm để chọn bàn');
    const tables = await db.venueTable.findMany({ where: { id: { in: e.tableIds }, venueId: e.venueId }, select: { id: true, isActive: true } });
    if (tables.length !== e.tableIds.length) throw fieldError('tableIds', 'Có bàn không thuộc địa điểm của buổi này');
    if (tables.some((t) => newTableIds.includes(t.id) && !t.isActive)) throw fieldError('tableIds', 'Có bàn đã ngừng sử dụng');
  }

  private async assertRemovedTablesFree(tx: Tx, sessionId: string, currentIds: string[], nextIds: string[]) {
    const removed = currentIds.filter((id) => !nextIds.includes(id));
    if (removed.length === 0) return;
    const inUse = await tx.match.count({ where: { sessionId, tableId: { in: removed } } });
    if (inUse > 0) {
      throw new ConflictException({ code: 'SESSION_TABLE_IN_USE', message: `Bàn bỏ khỏi buổi còn ${inUse} trận đã xếp, hãy dời hoặc bỏ xếp các trận trước`, dependants: { matches: inUse } });
    }
  }

  private async withRefresh<T extends object>(result: T, mutation: SessionMutation, event: EventRow, matchNos: number[]): Promise<T & { warnings?: string[] }> {
    const warnings = await this.revalidation.enqueue(async () => CACHE_TAGS[mutation](await loadScheduleTagContext(this.prisma, event.id, matchNos)));
    return warnings.length > 0 ? { ...result, warnings } : result;
  }

  private async requireEvent(eventId: string): Promise<EventRow> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true, slug: true, timezone: true, venueId: true, startDate: true, endDate: true } });
    if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Không tìm thấy giải đấu' });
    return event;
  }
}

/** The pre-checks cannot see a concurrent insert; @@unique([eventId, code]) is the final guard. */
function mapDuplicateCode(error: unknown, code: string | undefined): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return new ConflictException({ code: 'SESSION_CODE_EXISTS', message: `Mã buổi ${code ?? ''} đã tồn tại trong giải`, fields: { code: 'Mã đã tồn tại trong giải' } });
  }
  return error;
}

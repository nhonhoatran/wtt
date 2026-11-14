import { Injectable } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import { tournamentSettings } from '@kamito/shared';
import { AuditService } from '../../common/audit/audit.service.js';
import { fieldError } from '../../common/validation/parse-body.js';
import { MATCH_DETAIL_INCLUDE, toMatchDetail } from '../matches/match-result-view.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CACHE_TAGS } from '../revalidation/cache-tags.js';
import { RevalidationEnqueueService } from '../revalidation/revalidation-enqueue.service.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { ScheduleConflictService } from './schedule-conflict.service.js';
import { lockScheduleScope } from './schedule-locks.js';
import { loadScheduleTagContext } from './schedule-tag-context.js';
import { SCHEDULE_TX_TIMEOUT_MS } from './schedule-tx.js';
import type { ScheduleMatchBody } from './scheduling-dtos.js';
import { matchNotSchedulable, scheduleMatchNotFound, scheduleVersionConflict, sessionFull, sessionNotFound, slotOccupied, tableNotInSession } from './scheduling-errors.js';
import { recomputeSessionTimes } from './session-timeline.js';

type Tx = Prisma.TransactionClient;

interface Slot {
  sessionId: string | null;
  tableId: string | null;
  orderInSession: number | null;
}

interface Neighbour {
  id: string;
  matchNo: number;
}

interface Outcome {
  eventId: string;
  matchNos: number[];
  swappedMatchId: string | null;
}

const slotOf = (m: Slot): Slot => ({ sessionId: m.sessionId, tableId: m.tableId, orderInSession: m.orderInSession });
const sameSlot = (a: Slot, b: Slot) => a.sessionId === b.sessionId && a.tableId === b.tableId && a.orderInSession === b.orderInSession;
const lockMatch = (tx: Tx, id: string) => tx.$queryRaw`SELECT "id" FROM "Match" WHERE "id" = ${id} FOR UPDATE`;
const unchanged = (eventId: string): Outcome => ({ eventId, matchNos: [], swappedMatchId: null });
const EMPTY_SLOT: Slot = { sessionId: null, tableId: null, orderInSession: null };

@Injectable()
export class SchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly conflicts: ScheduleConflictService,
    private readonly settings: AppSettingsService,
    private readonly revalidation: RevalidationEnqueueService,
  ) {}

  /**
   * Place, move or unschedule (`sessionId: null`) one match. Locks on `scheduleVersion` only, so result
   * entry (`Match.version`) and scheduling never invalidate each other. An occupied target slot is swapped
   * with the occupant when both are SCHEDULED and the moved match already had a slot; otherwise 409.
   */
  async schedule(matchId: string, body: ScheduleMatchBody) {
    const outcome = await this.prisma.$transaction((tx) => this.apply(tx, matchId, body), { timeout: SCHEDULE_TX_TIMEOUT_MS });
    const row = await this.prisma.match.findUniqueOrThrow({ where: { id: matchId }, include: MATCH_DETAIL_INCLUDE });
    const conflicts = (await this.conflicts.forEvent(outcome.eventId)).get(matchId) ?? [];
    const warnings = await this.revalidation.enqueue(async () => CACHE_TAGS['schedule.update'](await loadScheduleTagContext(this.prisma, outcome.eventId, outcome.matchNos)));
    return { data: { ...toMatchDetail(row), conflicts }, swappedMatchId: outcome.swappedMatchId, ...(warnings.length > 0 && { warnings }) };
  }

  private async apply(tx: Tx, matchId: string, body: ScheduleMatchBody): Promise<Outcome> {
    const probe = await tx.match.findUnique({ where: { id: matchId }, select: { eventId: true, sessionId: true, drawId: true } });
    if (!probe) throw scheduleMatchNotFound();
    const sessionIds = [probe.sessionId, body.sessionId].filter((id): id is string => id !== null);
    await lockScheduleScope(tx, { sessionIds, matchIds: [matchId], drawId: probe.drawId });
    await lockMatch(tx, matchId);

    const match = await tx.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        matchNo: true,
        status: true,
        resultType: true,
        isVoided: true,
        sessionId: true,
        tableId: true,
        orderInSession: true,
        scheduleVersion: true,
        draw: { select: { status: true } },
      },
    });
    if (!match) throw scheduleMatchNotFound();
    if (match.scheduleVersion !== body.expectedScheduleVersion || match.sessionId !== probe.sessionId) throw scheduleVersionConflict(match.scheduleVersion);
    if (match.status !== 'SCHEDULED') throw matchNotSchedulable('Chỉ xếp, dời hoặc bỏ xếp được trận chưa đấu');

    const before = slotOf(match);
    if (body.sessionId === null) {
      if (!match.sessionId) return unchanged(probe.eventId);
      return this.finish(tx, match, probe.eventId, before, EMPTY_SLOT, null);
    }
    if (match.draw.status !== 'PUBLISHED' || match.isVoided || match.resultType === 'BYE' || match.resultType === 'WALKOVER') {
      throw matchNotSchedulable('Trận này không xếp lịch được');
    }

    const session = await tx.eventSession.findFirst({ where: { id: body.sessionId, eventId: probe.eventId }, select: { tables: { select: { tableId: true } } } });
    if (!session) throw sessionNotFound();
    if (!session.tables.some((t) => t.tableId === body.tableId)) throw tableNotInSession();
    const tableId = body.tableId as string;
    const cap = await this.settings.get(tournamentSettings.scheduleSessionMatchCap);

    const last = await tx.match.aggregate({ where: { sessionId: body.sessionId, tableId, isVoided: false }, _max: { orderInSession: true } });
    const target: Slot = { sessionId: body.sessionId, tableId, orderInSession: body.orderInSession ?? (last._max.orderInSession ?? 0) + 1 };
    if (target.orderInSession! > cap) throw fieldError('orderInSession', `Thứ tự tối đa ${cap}`);
    if (sameSlot(before, target)) return unchanged(probe.eventId);

    const occupant = await this.lockOccupant(tx, matchId, target, before, body.orderInSession === undefined ? undefined : body.expectedOccupantId);
    if (!occupant && match.sessionId !== body.sessionId && (await tx.match.count({ where: { sessionId: body.sessionId, isVoided: false } })) >= cap) {
      throw sessionFull(cap);
    }
    return this.finish(tx, match, probe.eventId, before, target, occupant);
  }

  private async lockOccupant(tx: Tx, matchId: string, target: Slot, before: Slot, expectedOccupantId: string | null | undefined): Promise<Neighbour | null> {
    const found = await tx.match.findFirst({ where: { ...target, id: { not: matchId }, isVoided: false }, select: { id: true } });
    if (expectedOccupantId !== undefined && (found?.id ?? null) !== expectedOccupantId) throw slotOccupied('Ô vừa được thay đổi, tải lại lịch');
    if (!found) return null;
    await lockMatch(tx, found.id);
    const occupant = await tx.match.findUnique({ where: { id: found.id }, select: { id: true, matchNo: true, status: true, sessionId: true, tableId: true, orderInSession: true } });
    if (!occupant || !sameSlot(slotOf(occupant), target)) throw slotOccupied('Ô vừa được thay đổi, tải lại lịch');
    if (occupant.status !== 'SCHEDULED') throw slotOccupied('Ô đã có trận đang đấu hoặc đã đấu, chọn ô khác');
    if (!before.sessionId) throw slotOccupied('Ô đã có trận khác. Chọn ô trống hoặc kéo một trận đã xếp để đổi chỗ');
    return occupant;
  }

  private async finish(tx: Tx, match: Neighbour, eventId: string, before: Slot, target: Slot, occupant: Neighbour | null): Promise<Outcome> {
    if (occupant) {
      await tx.match.update({ where: { id: occupant.id }, data: { ...before, scheduleVersion: { increment: 1 } } });
      await this.audit.record({ action: 'match.schedule', entity: 'Match', entityId: occupant.id, before: target, after: { ...before, swappedWith: match.id } }, tx);
    }
    await tx.match.update({
      where: { id: match.id },
      data: { ...target, ...(target.sessionId === null && { scheduledAt: null }), scheduleVersion: { increment: 1 } },
    });
    const affected = [...new Set([before.sessionId, target.sessionId].filter((id): id is string => id !== null))].sort();
    const retimed: number[] = [];
    for (const id of affected) retimed.push(...(await recomputeSessionTimes(tx, id)));
    await this.audit.record({ action: 'match.schedule', entity: 'Match', entityId: match.id, before, after: { ...target, ...(occupant && { swappedWith: occupant.id }) } }, tx);
    const matchNos = [match.matchNo, ...(occupant ? [occupant.matchNo] : []), ...retimed];
    return { eventId, matchNos: [...new Set(matchNos)], swappedMatchId: occupant?.id ?? null };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { isStructureLocked } from '@kamito/db';
import { GroupViewService } from '../groups/group-view.service.js';
import { MatchQueryService } from '../matches/match-query.service.js';
import { ENTRY_BRIEF_SELECT, toEntryBrief } from '../matches/match-view.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { drawNotFound } from './draw-errors.js';
import { DRAW_INCLUDE, FORMAT_SELECT, formatOf } from './round-format-view.js';
import { toDrawSummary } from './draw-view.js';

@Injectable()
export class DrawReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matches: MatchQueryService,
    private readonly groupViews: GroupViewService,
  ) {}

  private async loadDraw(drawId: string) {
    const draw = await this.prisma.draw.findUnique({ where: { id: drawId }, include: DRAW_INCLUDE });
    if (!draw) throw drawNotFound();
    return { draw, locked: await isStructureLocked(this.prisma, drawId) };
  }

  async bracket(drawId: string, includeSeed: boolean) {
    const { draw, locked } = await this.loadDraw(drawId);
    const [positions, rounds, matches] = await Promise.all([
      this.prisma.bracketPosition.findMany({
        where: { drawId },
        include: { entry: { select: ENTRY_BRIEF_SELECT } },
        orderBy: [{ section: 'asc' }, { position: 'asc' }],
      }),
      this.prisma.round.findMany({
        where: { drawId, groupId: null },
        include: { matchFormat: FORMAT_SELECT },
        orderBy: [{ scopeKey: 'asc' }, { number: 'asc' }],
      }),
      this.matches.listForDraw(drawId, { groupId: null }),
    ]);
    return {
      data: {
        ...toDrawSummary(draw, locked, includeSeed),
        positions: positions.map(({ entry, ...p }) => ({
          id: p.id,
          section: p.section,
          position: p.position,
          source: p.source,
          sourceRef: p.sourceRef,
          entry: toEntryBrief(entry),
        })),
        rounds: rounds.map((r) => ({
          id: r.id,
          section: r.section,
          scopeKey: r.scopeKey,
          number: r.number,
          code: r.code,
          matchFormatId: r.matchFormatId,
          ...formatOf(r, draw),
        })),
        matches,
      },
    };
  }

  async groups(drawId: string, includeSeed: boolean) {
    const { draw, locked } = await this.loadDraw(drawId);
    return { data: { ...toDrawSummary(draw, locked, includeSeed), groups: await this.groupViews.forDraw(drawId, draw) } };
  }

  /** Side menu of the Draw tab: every sub-event of the event with the status of its draws. */
  async eventSummary(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Không tìm thấy giải đấu' });
    const [subEvents, started] = await Promise.all([
      this.prisma.subEvent.findMany({
        where: { eventId },
        orderBy: [{ order: 'asc' }, { code: 'asc' }],
        select: { id: true, code: true, name: true, format: true, hasQualifying: true, draws: { orderBy: { kind: 'asc' } } },
      }),
      this.prisma.match.findMany({
        where: { eventId, status: { in: ['LIVE', 'OFFICIAL'] }, OR: [{ resultType: null }, { resultType: { not: 'BYE' } }] },
        distinct: ['drawId'],
        select: { drawId: true },
      }),
    ]);
    const lockedIds = new Set(started.map((m) => m.drawId));
    return {
      data: subEvents.map((se) => ({
        subEventId: se.id,
        code: se.code,
        name: se.name,
        format: se.format,
        hasQualifying: se.hasQualifying,
        draws: se.draws.map((d) => ({ id: d.id, kind: d.kind, status: d.status, locked: lockedIds.has(d.id), version: d.version })),
      })),
    };
  }
}

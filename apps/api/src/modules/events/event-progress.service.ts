import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { summarizeProgress, type EventProgress } from './event-progress.js';

type Undecided = 'BYE' | 'WALKOVER';

/** Matches that still need a slot: not a bye, not decided by walkover, not voided. */
const schedulable = (eventId: string) => ({
  eventId,
  isVoided: false,
  OR: [{ resultType: null }, { resultType: { notIn: ['BYE', 'WALKOVER'] as Undecided[] } }],
});

@Injectable()
export class EventProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async get(eventId: string): Promise<EventProgress> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) throw new NotFoundException('Event not found');

    const [subEvents, confirmed, [total, unscheduled, official]] = await Promise.all([
      this.prisma.subEvent.findMany({
        where: { eventId },
        select: { id: true, format: true, hasQualifying: true, draws: { select: { kind: true, status: true } } },
      }),
      this.prisma.entry.groupBy({ by: ['subEventId'], where: { status: 'CONFIRMED', subEvent: { eventId } }, _count: { _all: true } }),
      this.prisma.$transaction([
        this.prisma.match.count({ where: schedulable(eventId) }),
        this.prisma.match.count({ where: { ...schedulable(eventId), status: 'SCHEDULED', sessionId: null } }),
        this.prisma.match.count({ where: { ...schedulable(eventId), status: 'OFFICIAL' } }),
      ]),
    ]);
    const confirmedById = new Map(confirmed.map((row) => [row.subEventId, row._count._all]));
    return summarizeProgress(
      subEvents,
      subEvents.map((subEvent) => confirmedById.get(subEvent.id) ?? 0),
      { total, unscheduled, official },
    );
  }
}

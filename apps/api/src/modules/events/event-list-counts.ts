import { EVENT_LIFECYCLES } from '@kamito/shared';
import type { PrismaService } from '../prisma/prisma.service.js';

type Lifecycle = (typeof EVENT_LIFECYCLES)[number];

export type LifecycleCounts = Record<Lifecycle | 'ALL', number>;

/** CONFIRMED entries per event, for the events on one list page. */
export async function confirmedEntryCounts(prisma: PrismaService, eventIds: readonly string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (eventIds.length === 0) return counts;
  const subEvents = await prisma.subEvent.findMany({ where: { eventId: { in: [...eventIds] } }, select: { id: true, eventId: true } });
  const eventBySubEvent = new Map(subEvents.map((row) => [row.id, row.eventId]));
  const grouped = await prisma.entry.groupBy({
    by: ['subEventId'],
    where: { status: 'CONFIRMED', subEventId: { in: [...eventBySubEvent.keys()] } },
    _count: { _all: true },
  });
  for (const row of grouped) {
    const eventId = eventBySubEvent.get(row.subEventId);
    if (eventId) counts.set(eventId, (counts.get(eventId) ?? 0) + row._count._all);
  }
  return counts;
}

/** One count per lifecycle on top of the same base where the list uses (everything except the lifecycle filter). */
export async function lifecycleCounts(
  prisma: PrismaService,
  baseWhere: Record<string, unknown>,
  lifecycleWhere: (lifecycle: Lifecycle) => Record<string, unknown>,
): Promise<LifecycleCounts> {
  const [all, ...perLifecycle] = await prisma.$transaction([
    prisma.event.count({ where: baseWhere }),
    ...EVENT_LIFECYCLES.map((lifecycle) => prisma.event.count({ where: { AND: [baseWhere, lifecycleWhere(lifecycle)] } })),
  ]);
  const counts = { ALL: all } as LifecycleCounts;
  EVENT_LIFECYCLES.forEach((lifecycle, index) => {
    counts[lifecycle] = perLifecycle[index] ?? 0;
  });
  return counts;
}

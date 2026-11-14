import type { Prisma } from '@kamito/db';
import { lockSessionsInOrder } from './schedule-locks.js';
import { recomputeSessionTimes } from './session-timeline.js';

/**
 * Clears the schedule slot of matches that stop being playable (voided by a withdrawal, draw unpublished
 * or rebuilt) and re-times the sessions they leave, in the caller's transaction. Callers already hold
 * their SubEvent and Draw locks, so only sessions are locked here.
 */
export async function releaseScheduleSlots(tx: Prisma.TransactionClient, where: Prisma.MatchWhereInput): Promise<void> {
  const rows = await tx.match.findMany({ where: { AND: [where, { sessionId: { not: null } }] }, select: { id: true, sessionId: true } });
  if (rows.length === 0) return;
  const sessionIds = [...new Set(rows.map((r) => r.sessionId as string))];
  await lockSessionsInOrder(tx, sessionIds);
  await tx.match.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { sessionId: null, tableId: null, orderInSession: null, scheduledAt: null, scheduleVersion: { increment: 1 } },
  });
  for (const id of [...sessionIds].sort()) await recomputeSessionTimes(tx, id);
}

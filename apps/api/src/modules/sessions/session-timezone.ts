import type { Prisma } from '@kamito/db';
import { formatDateOnly } from '../events/date-only.js';
import { lockScheduleScope } from '../scheduling/schedule-locks.js';
import { recomputeSessionTimes } from '../scheduling/session-timeline.js';
import { instantToHhmm, zonedTimeToInstant } from './session-time.js';

/**
 * Sessions store UTC instants read in the event timezone. When the timezone changes the wall-clock times
 * (08:00 stays 08:00) are kept: instants are re-converted and the derived match times follow; returns the numbers of the re-timed matches.
 */
export async function reconvertSessionsTimezone(tx: Prisma.TransactionClient, eventId: string, from: string, to: string): Promise<number[]> {
  const sessions = await tx.eventSession.findMany({ where: { eventId }, select: { id: true, date: true, startTime: true, endTime: true } });
  if (sessions.length === 0) return [];
  await lockScheduleScope(tx, { sessionIds: sessions.map((s) => s.id) });
  for (const s of sessions) {
    const date = formatDateOnly(s.date);
    await tx.eventSession.update({
      where: { id: s.id },
      data: {
        startTime: zonedTimeToInstant(date, instantToHhmm(s.startTime, from), to),
        endTime: s.endTime ? zonedTimeToInstant(date, instantToHhmm(s.endTime, from), to) : null,
      },
    });
  }
  const retimed: number[] = [];
  for (const s of [...sessions].sort((a, b) => a.id.localeCompare(b.id))) retimed.push(...(await recomputeSessionTimes(tx, s.id)));
  return retimed;
}

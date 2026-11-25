import type { Prisma } from '@kamito/db';
import { lifecycleFromDates, todayInTimezone } from '@kamito/shared';
import { formatDateOnly, parseDateOnly } from '../events/date-only.js';

const DAY_MS = 86_400_000;

export interface DatedEvent {
  id: string;
  timezone: string;
  startDate: Date;
  endDate: Date;
  isCancelled: boolean;
}

/** Wide enough for every timezone (offsets stay within a day of UTC); the exact "ongoing" test runs per event timezone. */
export function ongoingCandidateWhere(now: Date): Prisma.EventWhereInput {
  return {
    isCancelled: false,
    startDate: { lte: parseDateOnly(formatDateOnly(new Date(now.getTime() + DAY_MS))) },
    endDate: { gte: parseDateOnly(formatDateOnly(new Date(now.getTime() - DAY_MS))) },
  };
}

/** Keeps events that are ongoing "today" in their own timezone, same rule as the events lifecycle tag. */
export function pickOngoing<T extends DatedEvent>(events: readonly T[], now: Date): T[] {
  return events.filter(
    (event) =>
      lifecycleFromDates({
        startDate: formatDateOnly(event.startDate),
        endDate: formatDateOnly(event.endDate),
        isCancelled: event.isCancelled,
        today: todayInTimezone(event.timezone, now),
      }) === 'ONGOING',
  );
}

/** Matches that count for the dashboard: published draws only, no byes, no voided group matches. */
export const DASHBOARD_MATCH_BASE: Prisma.MatchWhereInput = {
  isVoided: false,
  draw: { status: 'PUBLISHED' },
  OR: [{ resultType: null }, { resultType: { not: 'BYE' } }],
};

/** Today's session matches of the given events, each event judged against today in its own timezone. */
export function todayMatchWhere(events: readonly Pick<DatedEvent, 'id' | 'timezone'>[], now: Date): Prisma.MatchWhereInput {
  const idsByDate = new Map<string, string[]>();
  for (const event of events) {
    const today = todayInTimezone(event.timezone, now);
    idsByDate.set(today, [...(idsByDate.get(today) ?? []), event.id]);
  }
  const perDate: Prisma.MatchWhereInput[] = [...idsByDate].map(([date, ids]) => ({
    eventId: { in: ids },
    session: { date: parseDateOnly(date) },
  }));
  return { AND: [DASHBOARD_MATCH_BASE, { OR: perDate }] };
}

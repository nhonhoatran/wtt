const DAY_MS = 86_400_000;

// Calendar dates (YYYY-MM-DD) are compared as UTC midnights, so DST or the server zone never shift the count.
const dayNumber = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);

/** Number of calendar days an event spans, both ends included. */
export function eventDayCount(startDate: string, endDate: string): number {
  return dayNumber(endDate) - dayNumber(startDate) + 1;
}

/** "Day x of y" of `today` inside the event; null when today is outside the event. */
export function eventDayProgress(startDate: string, endDate: string, today: string): { day: number; total: number } | null {
  if (today < startDate || today > endDate) return null;
  return { day: dayNumber(today) - dayNumber(startDate) + 1, total: eventDayCount(startDate, endDate) };
}

export type DayRelation = 'past' | 'today' | 'tomorrow' | 'later';

/** How a calendar day relates to `today` (both in the event's own zone). */
export function dayRelation(day: string, today: string): DayRelation {
  const diff = dayNumber(day) - dayNumber(today);
  if (diff < 0) return 'past';
  if (diff === 0) return 'today';
  return diff === 1 ? 'tomorrow' : 'later';
}

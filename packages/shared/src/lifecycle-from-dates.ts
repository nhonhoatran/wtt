export const EVENT_LIFECYCLES = ['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'] as const;
export type EventLifecycle = (typeof EVENT_LIFECYCLES)[number];

export function isEventLifecycle(value: string): value is EventLifecycle {
  return (EVENT_LIFECYCLES as readonly string[]).includes(value);
}

/** Calendar date (YYYY-MM-DD) of `now` in the event's timezone. */
export function todayInTimezone(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Derived from dates, never stored: admins do not flip it by hand. Dates are YYYY-MM-DD. */
export function lifecycleFromDates(input: {
  startDate: string;
  endDate: string;
  isCancelled: boolean;
  today: string;
}): EventLifecycle {
  if (input.isCancelled) return 'CANCELLED';
  if (input.today < input.startDate) return 'UPCOMING';
  if (input.today > input.endDate) return 'COMPLETED';
  return 'ONGOING';
}

export const EVENT_LIFECYCLE_LABELS: Record<EventLifecycle, string> = {
  UPCOMING: 'Sắp diễn ra',
  ONGOING: 'Đang diễn ra',
  COMPLETED: 'Đã kết thúc',
  CANCELLED: 'Đã hủy',
};

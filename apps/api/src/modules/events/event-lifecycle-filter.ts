import { EVENT_LIFECYCLES, isEventLifecycle, todayInTimezone } from '@kamito/shared';
import { invalidQuery } from '../../common/crud/prisma-list-query.js';
import { parseDateOnly } from './date-only.js';

type Where = Record<string, unknown>;
type Lifecycle = (typeof EVENT_LIFECYCLES)[number];

/** Lifecycle is derived, so it is translated to date-range conditions against `today`. */
function lifecycleWhere(lifecycle: Lifecycle, today: Date): Where {
  switch (lifecycle) {
    case 'CANCELLED':
      return { isCancelled: true };
    case 'UPCOMING':
      return { isCancelled: false, startDate: { gt: today } };
    case 'ONGOING':
      return { isCancelled: false, startDate: { lte: today }, endDate: { gte: today } };
    case 'COMPLETED':
      return { isCancelled: false, endDate: { lt: today } };
  }
}

/** Each event is judged against "today" in its own timezone, matching the lifecycle tag shown in the UI. */
export function lifecycleFilter(timezones: readonly string[], now: Date = new Date()) {
  return (value: string): Where => {
    const values = value.split(',');
    if (!values.every(isEventLifecycle)) throw invalidQuery('Unknown lifecycle');
    return {
      OR: timezones.flatMap((timezone) => {
        const today = parseDateOnly(todayInTimezone(timezone, now));
        return values.map((item) => ({ AND: [{ timezone }, lifecycleWhere(item as Lifecycle, today)] }));
      }),
    };
  };
}

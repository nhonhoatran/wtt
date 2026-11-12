import { lifecycleFromDates, todayInTimezone, type EventLifecycle } from '@kamito/shared';
import { formatDateOnly } from './date-only.js';

const TIER_SELECT = { id: true, code: true, name: true, nameEn: true, colorHex: true } as const;

/** Relations shown on every event view; banner is minimal (preview only). */
export const EVENT_RELATIONS = {
  eventType: { select: { id: true, code: true, name: true, nameEn: true, colorHex: true, tier: { select: TIER_SELECT } } },
  venue: { select: { id: true, name: true, nameEn: true, city: true } },
  bannerMedia: { select: { id: true, status: true, publicKey: true, width: true, height: true, altText: true, altTextEn: true } },
  _count: { select: { subEvents: true } },
} as const;

/** List view: everything except the heavy rich-text bodies. */
export const EVENT_LIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  nameEn: true,
  shortName: true,
  eventTypeId: true,
  venueId: true,
  city: true,
  startDate: true,
  endDate: true,
  timezone: true,
  publishStatus: true,
  publishedAt: true,
  isCancelled: true,
  isFeatured: true,
  ticketUrl: true,
  showTicket: true,
  presentedBy: true,
  bannerMediaId: true,
  summary: true,
  summaryEn: true,
  showInfoTab: true,
  createdAt: true,
  updatedAt: true,
  ...EVENT_RELATIONS,
} as const;

interface DatedEvent {
  startDate: Date;
  endDate: Date;
  isCancelled: boolean;
  timezone: string;
}

export type EventView<T extends DatedEvent> = Omit<T, 'startDate' | 'endDate'> & {
  startDate: string;
  endDate: string;
  lifecycle: EventLifecycle;
};

/** Dates as YYYY-MM-DD plus the derived lifecycle (today in the event's own timezone). */
export function toEventView<T extends DatedEvent>(row: T, now: Date = new Date()): EventView<T> {
  const startDate = formatDateOnly(row.startDate);
  const endDate = formatDateOnly(row.endDate);
  const lifecycle = lifecycleFromDates({
    startDate,
    endDate,
    isCancelled: row.isCancelled,
    today: todayInTimezone(row.timezone, now),
  });
  return { ...row, startDate, endDate, lifecycle };
}

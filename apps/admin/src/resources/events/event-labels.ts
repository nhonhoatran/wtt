import { EVENT_LIFECYCLE_LABELS, EVENT_LIFECYCLES, type EventLifecycle } from '@kamito/shared';
import dayjs from 'dayjs';

export interface EventRecord {
  id: string;
  slug: string;
  name: string;
  nameEn: string | null;
  shortName: string | null;
  eventTypeId: string;
  venueId: string | null;
  city: string | null;
  startDate: string;
  endDate: string;
  timezone: string;
  publishStatus: 'DRAFT' | 'PUBLISHED';
  isCancelled: boolean;
  isFeatured: boolean;
  ticketUrl: string | null;
  showTicket: boolean;
  presentedBy: string | null;
  bannerMediaId: string | null;
  summary: string | null;
  summaryEn: string | null;
  infoBody: string | null;
  infoBodyEn: string | null;
  showInfoTab: boolean;
  updatedAt: string;
  lifecycle: EventLifecycle;
  eventType: { id: string; name: string; colorHex: string | null; tier: { colorHex: string } };
  venue: { id: string; name: string; city: string | null } | null;
  bannerMedia: { id: string; publicKey: string | null } | null;
  _count: { subEvents: number };
}

export const EVENT_FORM_MAX_WIDTH = 720;
/** Years offered by the list filter on each side of the current year. */
export const FILTER_YEARS_BACK = 5;
export const FILTER_YEARS_AHEAD = 1;
export const DATE_ONLY_FORMAT = 'YYYY-MM-DD';
export const DISPLAY_DATE_FORMAT = 'DD/MM/YYYY';

export const LIFECYCLE_OPTIONS = EVENT_LIFECYCLES.map((value) => ({ value, label: EVENT_LIFECYCLE_LABELS[value] }));
export const PUBLISH_LABELS = { DRAFT: 'Bản nháp', PUBLISHED: 'Đã công bố' } as const;
export const PUBLISH_OPTIONS = Object.entries(PUBLISH_LABELS).map(([value, label]) => ({ value, label }));

export const LIFECYCLE_COLORS: Record<EventLifecycle, string | undefined> = {
  UPCOMING: 'blue',
  ONGOING: 'green',
  COMPLETED: undefined,
  CANCELLED: 'red',
};

export function yearOptions(now: Date = new Date()): { value: string; label: string }[] {
  const current = now.getFullYear();
  const years: number[] = [];
  for (let year = current + FILTER_YEARS_AHEAD; year >= current - FILTER_YEARS_BACK; year -= 1) years.push(year);
  return years.map((year) => ({ value: String(year), label: String(year) }));
}

export const formatDateRange = (event: Pick<EventRecord, 'startDate' | 'endDate'>) =>
  `${dayjs(event.startDate).format(DISPLAY_DATE_FORMAT)} – ${dayjs(event.endDate).format(DISPLAY_DATE_FORMAT)}`;

export const eventTypeColor = (event: Pick<EventRecord, 'eventType'>) => event.eventType.colorHex ?? event.eventType.tier.colorHex;

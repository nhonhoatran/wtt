import dayjs, { type Dayjs } from 'dayjs';
import { DATE_ONLY_FORMAT, type EventRecord } from './event-labels';

export interface EventFormValues {
  name: string;
  slug?: string;
  eventTypeId?: string;
  startDate?: Dayjs;
  endDate?: Dayjs;
  timezone?: string;
  venueId?: string | null;
  city?: string | null;
  isFeatured?: boolean;
  ticketUrl?: string | null;
  showTicket?: boolean;
  bannerMediaId?: string | null;
  nameEn?: string | null;
  shortName?: string | null;
  presentedBy?: string | null;
  summary?: string | null;
  summaryEn?: string | null;
  infoBody?: string | null;
  infoBodyEn?: string | null;
  showInfoTab?: boolean;
}

const blankToNull = (value: string | null | undefined) => value?.trim() || null;

/** Form -> request body. Cleared inputs become null so the API clears the stored value. */
export function toEventPayload(values: EventFormValues): Record<string, unknown> {
  const { startDate, endDate, ...rest } = values;
  const payload: Record<string, unknown> = {
    ...rest,
    startDate: startDate?.format(DATE_ONLY_FORMAT),
    endDate: endDate?.format(DATE_ONLY_FORMAT),
    venueId: values.venueId ?? null,
    bannerMediaId: values.bannerMediaId ?? null,
    ticketUrl: blankToNull(values.ticketUrl),
  };
  for (const key of ['city', 'nameEn', 'shortName', 'presentedBy', 'summary', 'summaryEn'] as const) {
    if (key in values) payload[key] = blankToNull(values[key]);
  }
  if ('infoBody' in values) payload.infoBody = values.infoBody || null;
  if ('infoBodyEn' in values) payload.infoBodyEn = values.infoBodyEn || null;
  return payload;
}

export function toEventFormValues(event: EventRecord): EventFormValues {
  return {
    name: event.name,
    slug: event.slug,
    eventTypeId: event.eventTypeId,
    startDate: dayjs(event.startDate),
    endDate: dayjs(event.endDate),
    timezone: event.timezone,
    venueId: event.venueId,
    city: event.city,
    isFeatured: event.isFeatured,
    ticketUrl: event.ticketUrl,
    showTicket: event.showTicket,
    bannerMediaId: event.bannerMediaId,
    nameEn: event.nameEn,
    shortName: event.shortName,
    presentedBy: event.presentedBy,
    summary: event.summary,
    summaryEn: event.summaryEn,
    infoBody: event.infoBody,
    infoBodyEn: event.infoBodyEn,
    showInfoTab: event.showInfoTab,
  };
}

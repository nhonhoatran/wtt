import type { EventLifecycle } from './lifecycle-from-dates.js';
import type { PublicDrawKind, PublicSide } from './public-bracket-contract.js';

/** Response contracts of the public event and match endpoints, shared by the API serializers and the client. */

export const PUBLIC_EVENT_STATUSES = { upcoming: 'UPCOMING', ongoing: 'ONGOING', completed: 'COMPLETED' } as const;
export type PublicEventStatusParam = keyof typeof PUBLIC_EVENT_STATUSES;

export const PUBLIC_MATCH_STATES = ['live', 'completed', 'upcoming'] as const;
export type PublicMatchState = (typeof PUBLIC_MATCH_STATES)[number];

export const PUBLIC_SEARCH_MAX_LENGTH = 100;

export interface PublicNamed {
  name: string;
  nameEn: string | null;
}

export interface PublicCoded extends PublicNamed {
  code: string;
}

export interface PublicImage {
  url: string;
  width: number;
  height: number;
  alt: string | null;
  altEn: string | null;
}

export interface PublicEventCard extends PublicNamed {
  slug: string;
  shortName: string | null;
  /** YYYY-MM-DD in the event's own calendar. */
  startDate: string;
  endDate: string;
  timezone: string;
  lifecycle: Exclude<EventLifecycle, 'CANCELLED'>;
  city: string | null;
  venue: PublicNamed | null;
  tier: PublicCoded & { colorHex: string };
  eventType: PublicCoded & { colorHex: string | null };
  banner: PublicImage | null;
}

export interface PublicEventFilters {
  tiers: (PublicCoded & { colorHex: string })[];
  eventTypes: (PublicCoded & { tierCode: string })[];
  years: number[];
}

export interface PublicEventList {
  items: PublicEventCard[];
  page: number;
  pageSize: number;
  total: number;
  filters: PublicEventFilters;
}

export interface PublicCalendarMonth {
  /** YYYY-MM */
  month: string;
  events: PublicEventCard[];
}

export interface PublicEventCalendar {
  year: number;
  months: PublicCalendarMonth[];
  filters: PublicEventFilters;
}

export interface PublicSubEventSummary extends PublicCoded {
  format: 'KNOCKOUT' | 'GROUP_KNOCKOUT';
  /** Published knockout draws (bracket tab) and whether a published group stage exists. */
  drawKinds: PublicDrawKind[];
  hasGroups: boolean;
  entryCount: number;
}

export interface PublicChampion {
  subEventCode: string;
  side: PublicSide;
}

export interface PublicEventTabs {
  matches: boolean;
  draws: boolean;
  groups: boolean;
  players: boolean;
  info: boolean;
}

export interface PublicEventDetail extends PublicEventCard {
  summary: string | null;
  summaryEn: string | null;
  presentedBy: string | null;
  /** Only set while the organiser shows the ticket link. */
  ticketUrl: string | null;
  subEvents: PublicSubEventSummary[];
  tabs: PublicEventTabs;
  stats: { players: number; playedMatches: number };
  champions: PublicChampion[];
}

export interface PublicEventInfo {
  /** Sanitized again by the API on the way out. */
  infoBody: string | null;
  infoBodyEn: string | null;
}

// Preserve existing imports while competition payloads live in their own contract module.
export * from './public-competition-contract.js';

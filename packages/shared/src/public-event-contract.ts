import type { EventLifecycle } from './lifecycle-from-dates.js';
import type { PublicDrawKind, PublicGame, PublicSide, PublicSideSource } from './public-bracket-contract.js';

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

export interface PublicMatchContext {
  subEvent: PublicCoded;
  drawKind: PublicDrawKind | 'GROUP';
  round: { code: string; number: number };
  groupCode: string | null;
}

export interface PublicMatchCard extends PublicMatchContext {
  matchNo: number;
  status: 'SCHEDULED' | 'LIVE' | 'OFFICIAL';
  resultType: 'NORMAL' | 'WALKOVER' | 'RETIRED' | 'DISQUALIFIED' | null;
  winnerSide: 1 | 2 | null;
  games1: number | null;
  games2: number | null;
  scheduledAt: string | null;
  side1: PublicSide | null;
  side2: PublicSide | null;
  side1Source: PublicSideSource | null;
  side2Source: PublicSideSource | null;
  games: PublicGame[];
  /** Result cancelled by a withdrawal (VOID_ALL_RESULTS); shown as history, not counted in standings. */
  voided: boolean;
}

export interface PublicMatchList {
  state: PublicMatchState;
  items: PublicMatchCard[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PublicMatchDetail extends PublicMatchCard {
  event: PublicNamed & { slug: string; timezone: string };
  startedAt: string | null;
  officialAt: string | null;
}

export interface PublicGroupStandingRow {
  rank: number | null;
  side: PublicSide;
  played: number;
  won: number;
  lost: number;
  matchPoints: number;
  gamesFor: number;
  gamesAgainst: number;
  qualified: boolean;
}

export interface PublicGroup {
  code: string;
  standings: PublicGroupStandingRow[];
  matches: PublicMatchCard[];
}

export interface PublicGroups {
  event: PublicNamed & { slug: string; timezone: string };
  subEvent: PublicCoded;
  groups: PublicGroup[];
}

export const PUBLIC_ENTRY_STAGES = { main: 'MAIN', qualifying: 'QUALIFYING' } as const;
export type PublicEntryStageParam = keyof typeof PUBLIC_ENTRY_STAGES;

export interface PublicEntryList {
  subEvent: PublicCoded;
  stage: (typeof PUBLIC_ENTRY_STAGES)[PublicEntryStageParam];
  /** Stages that have at least one confirmed entry. */
  stages: (typeof PUBLIC_ENTRY_STAGES)[PublicEntryStageParam][];
  items: PublicSide[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PublicStripItem extends PublicMatchCard {
  event: PublicNamed & { slug: string };
}

export interface PublicResultsStrip {
  items: PublicStripItem[];
}

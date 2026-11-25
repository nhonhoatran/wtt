import type { PublicCoded, PublicNamed } from './public-event-contract.js';
import type { PublicDrawKind, PublicGame, PublicSide, PublicSideSource, PublicTable } from './public-bracket-contract.js';
import type { PublicMatchState } from './public-event-contract.js';

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
  table: PublicTable | null;
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
  session: { code: string; name: string | null; nameEn: string | null } | null;
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

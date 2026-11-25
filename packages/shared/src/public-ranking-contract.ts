import type { PublicCoded, PublicImage, PublicNamed } from './public-event-contract.js';
import type { PublicMatchCard } from './public-competition-contract.js';

/** Public labels only; a private, inactive or merged player has no profile link. */
export interface PublicRankingPlayer extends PublicNamed {
  slug: string | null;
  club: string | null;
  photo: PublicImage | null;
}

export interface PublicRankingListInfo extends PublicCoded {
  competitorKind: 'SINGLES' | 'DOUBLES';
  genderRule: 'MEN' | 'WOMEN' | 'MIXED' | 'OPEN';
  category: PublicCoded | null;
}

/** Frozen points; event labels are redacted when their event is no longer public. */
export interface PublicPointsBreakdown {
  eventSlug: string | null;
  eventName: string | null;
  eventNameEn: string | null;
  eventTypeCode: string | null;
  stageCode: string | null;
  points: number;
  earnedAt: string;
  expiresAt: string;
}

export interface PublicRankingRow {
  rank: number;
  previousRank: number | null;
  movement: number | null;
  points: number;
  resultsCounted: number;
  player: PublicRankingPlayer;
  breakdown: PublicPointsBreakdown[];
}

export interface PublicRankingTop {
  list: PublicRankingListInfo;
  asOfDate: string | null;
  publishedAt: string | null;
  items: PublicRankingRow[];
}

export interface PublicRankingOverview {
  topN: number;
  items: PublicRankingTop[];
}

export interface PublicRankingList extends PublicRankingTop {
  page: number;
  pageSize: number;
  total: number;
  clubs: string[];
}

export interface PublicPlayerRank {
  list: PublicRankingListInfo;
  rank: number;
  points: number;
  movement: number | null;
  asOfDate: string;
}

export interface PublicPlayerListItem extends PublicRankingPlayer {
  slug: string;
  gender: 'MALE' | 'FEMALE';
  ranks: PublicPlayerRank[];
}

export interface PublicPlayerList {
  items: PublicPlayerListItem[];
  page: number;
  pageSize: number;
  total: number;
  clubs: string[];
}

export interface PublicPlayerEvent extends PublicNamed {
  slug: string;
  startDate: string;
  endDate: string;
}

export interface PublicPlayerProfile extends PublicPlayerListItem {
  noindex: boolean;
  countryCode: string;
  handedness: 'LEFT' | 'RIGHT' | null;
  age: number | null;
  bio: string | null;
  bioEn: string | null;
  events: PublicPlayerEvent[];
  /** Wins and losses over the same match set as the player's results list. */
  record: { wins: number; losses: number };
}

export interface PublicPlayerRedirect {
  /** Target slug, never an arbitrary URL. The public page returns HTTP 301. */
  redirectTo: string;
}

export interface PublicPlayerResult extends PublicMatchCard {
  event: PublicNamed & { slug: string; timezone: string };
  officialAt: string | null;
}

export interface PublicPlayerResults {
  items: PublicPlayerResult[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PublicEventRankingPoints {
  items: {
    subEvent: PublicCoded;
    list: PublicRankingListInfo;
    rules: {
      drawKind: 'MAIN' | 'QUALIFYING' | 'GROUP';
      stageCode: string;
      points: number;
      effectiveFrom: string;
    }[];
  }[];
}

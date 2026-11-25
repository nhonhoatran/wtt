/** Inputs of the mutation-to-cache-tag builders in cache-tags.ts. */
export interface MatchTagContext {
  eventSlug: string;
  subEventCode: string;
  /** The match itself plus every match it fed (winner advanced into). */
  matchNos: number[];
  isGroupMatch: boolean;
  playerSlugs: string[];
}

export interface DrawTagContext {
  eventSlug: string;
  subEventCode: string;
  hasGroups: boolean;
  /** Set when match pages change too (publish, unpublish, post-publish edits). */
  matchNos?: number[];
  /** Players whose pages show the changed entry. */
  playerSlugs?: string[];
}

export interface RankingTagContext {
  listCode: string;
  /** Players whose rank or points changed (new, moved or dropped) in the published snapshot. */
  playerSlugs: string[];
}

export interface EventTagContext {
  /** Old and new slug when the slug changed. */
  eventSlugs: string[];
  subEventCodes: string[];
  /** Set for publish, unpublish and cancel flips: the event's matches appear on results and match pages. */
  matchNos?: number[];
  /** Players of the event; set only by the manual refresh button. */
  playerSlugs?: string[];
}

export interface SubEventTagContext {
  eventSlug: string;
  /** Old and new code when the code changed. */
  subEventCodes: string[];
}

export interface PlayerTagContext {
  playerSlugs: string[];
  /** Events whose pages show the player's name or entries, with the match numbers the player appears in. */
  events: { eventSlug: string; subEventCodes: string[]; matchNos: number[] }[];
}

export interface ScheduleTagContext {
  eventSlug: string;
  /** Matches whose slot or derived start time changed; their public pages show the time and table. */
  matchNos?: number[];
  /** Sub-events of those matches: bracket and group pages show each match's time and table. */
  subEventCodes?: string[];
}

export interface VenueTableTagContext {
  /** Matches played on the table; their cards, brackets, groups, match pages and the players' result pages show its label. */
  matches: { eventSlug: string; subEventCode: string; matchNo: number; isGroupMatch: boolean; playerSlugs: string[] }[];
}

export interface EventSlugsTagContext {
  /** Events whose cards and detail pages show the changed catalog row or image; empty for a change that only touches list filters. */
  eventSlugs: string[];
}

export interface SubEventUsageTagContext {
  /** Per event: the sub-events (and their matches) that show the renamed discipline or category. */
  events: { eventSlug: string; subEventCodes: string[]; matchNos: number[] }[];
}

export interface RankingListTagContext {
  /** Old and new code when the code changed. */
  codes: string[];
}

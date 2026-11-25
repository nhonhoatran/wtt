/** Response contract of GET /public/events/:slug/draws/:subEventCode, shared by the API serializer and the client. */

export const PUBLIC_DRAW_KINDS = { main: 'MAIN', qualifying: 'QUALIFYING' } as const;
export type PublicDrawKindParam = keyof typeof PUBLIC_DRAW_KINDS;
export type PublicDrawKind = (typeof PUBLIC_DRAW_KINDS)[PublicDrawKindParam];

export type PublicSideSource =
  | { type: 'WINNER_OF'; matchNo: number }
  | { type: 'QUALIFIER'; index: number }
  | { type: 'GROUP_PLACE'; group: string; place: number };

export interface PublicPlayerName {
  name: string;
  nameEn: string | null;
  club: string | null;
  /** Null when the profile is private, inactive or merged. */
  slug: string | null;
}

export interface PublicSide {
  seed: number | null;
  /** WC / Q markers; DIRECT entries carry null. */
  quota: 'WILDCARD' | 'QUALIFIER' | null;
  players: PublicPlayerName[];
}

export interface PublicTable {
  code: string;
  displayName: string | null;
}

export interface PublicGame {
  number: number;
  score1: number;
  score2: number;
}

export interface PublicBracketMatch {
  matchNo: number;
  orderInRound: number;
  status: 'SCHEDULED' | 'LIVE' | 'OFFICIAL';
  resultType: 'NORMAL' | 'WALKOVER' | 'RETIRED' | 'DISQUALIFIED' | 'BYE' | null;
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
}

export interface PublicBracketRound {
  code: string;
  number: number;
  matches: PublicBracketMatch[];
}

export interface PublicBracketSection {
  section: number;
  rounds: PublicBracketRound[];
}

export interface PublicBracket {
  /** `timezone` is the IANA zone the event's times are shown in. */
  event: { slug: string; name: string; nameEn: string | null; timezone: string };
  subEvent: { code: string; name: string; nameEn: string | null };
  draw: { kind: PublicDrawKind; size: number | null; publishedAt: string | null };
  /** Published knockout draws of this sub-event, for the main / qualifying switch. */
  availableKinds: PublicDrawKind[];
  sections: PublicBracketSection[];
}

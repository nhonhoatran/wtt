/**
 * Output contract of the engine. Everything is plain data so the API layer can persist it as-is:
 * matchNo is allocated by the database later, so matches reference each other by
 * (scopeKey, roundNumber, orderInRound) -- both 1-based.
 */

export type PositionSource = 'ENTRY' | 'BYE' | 'QUALIFIER' | 'GROUP_PLACE';

/** Placeholder that a bracket position or a match side waits for. */
export type PlaceholderRef =
  | { type: 'QUALIFIER'; index: number }
  | { type: 'GROUP_PLACE'; group: string; place: number };

export type SideSource =
  | PlaceholderRef
  | { type: 'WINNER_OF'; scopeKey: string; roundNumber: number; orderInRound: number };

export interface DrawEntry {
  id: string;
  /** Null/undefined = unseeded. Withdrawn entries may carry null. */
  seed?: number | null;
  pointsAtEntry?: number | null;
}

/** One slot of a knockout section; positions are 1..size. */
export interface BracketPositionData {
  section: number;
  position: number;
  source: PositionSource;
  entryId?: string;
  sourceRef?: PlaceholderRef;
}

export type RoundStyle = 'MAIN' | 'QUALIFYING';

export interface RoundData {
  /** 'S1'..'Sk' for knockout sections, 'G-A' for groups. */
  scopeKey: string;
  section: number;
  number: number;
  /** R64..R16, QF, SF, F | QF-1 (section final), QF-2.. | GR1.. */
  code: string;
}

export interface MatchTarget {
  roundNumber: number;
  orderInRound: number;
  side: 1 | 2;
}

export interface MatchData {
  scopeKey: string;
  roundNumber: number;
  orderInRound: number;
  section: number;
  /** Set for round-robin matches. */
  groupCode?: string;
  side1EntryId?: string;
  side2EntryId?: string;
  /** Null when the side is a concrete entry or a BYE. */
  side1Source: SideSource | null;
  side2Source: SideSource | null;
  next?: MatchTarget;
  /** BYE matches are born finished: status OFFICIAL, resultType BYE, winner already advanced. */
  bye?: { winnerSide: 1 | 2 };
  status: 'SCHEDULED' | 'OFFICIAL';
}

export interface KnockoutStructure {
  rounds: RoundData[];
  matches: MatchData[];
}

export interface KnockoutDraw extends KnockoutStructure {
  size: number;
  byeCount: number;
  positions: BracketPositionData[];
}

export type DrawParamsErrorCode =
  | 'INVALID_SIZE'
  | 'INVALID_SEED'
  | 'INVALID_PARAMS'
  | 'NOT_ENOUGH_ENTRIES'
  | 'BYE_VS_BYE'
  | 'QUALIFIER_VS_BYE'
  | 'CANNOT_PLACE'
  | 'INVALID_PLACEHOLDER_FILL'
  | 'WITHDRAWAL_POLICY_MISSING'
  | 'INVALID_MATCH_DATA';

/** Thrown for parameters the engine cannot honour; the API maps it to a 4xx. */
export class DrawParamsError extends Error {
  constructor(
    readonly code: DrawParamsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DrawParamsError';
  }
}

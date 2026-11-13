export type DrawKind = 'MAIN' | 'QUALIFYING' | 'GROUP';
export type DrawStatus = 'DRAFT' | 'PUBLISHED';

export interface DrawRef {
  id: string;
  kind: DrawKind;
  status: DrawStatus;
  locked: boolean;
  version: number;
}

/** One row of GET /admin/events/:eventId/draws. */
export interface DrawOverviewRow {
  subEventId: string;
  code: string;
  name: string | null;
  format: 'KNOCKOUT' | 'GROUP_KNOCKOUT';
  hasQualifying: boolean;
  draws: DrawRef[];
}

export interface DrawSummary extends DrawRef {
  subEventId: string;
  size: number | null;
  seedCount: number | null;
  qualifierCount: number | null;
  groupCount: number | null;
  advancePerGroup: number | null;
  /** Only returned to roles that may edit draws. */
  randomSeed?: string | number | null;
  publishedAt: string | null;
}

export interface EntryBrief {
  id: string;
  seed: number | null;
  status: string;
  stage: string;
  type: string;
  displayName: string;
  players: { id: string; fullName: string; club: string | null }[];
}

export type PositionSource = 'ENTRY' | 'BYE' | 'QUALIFIER' | 'GROUP_PLACE';

export interface BracketPosition {
  id: string;
  section: string;
  position: number;
  source: PositionSource;
  sourceRef: string | null;
  entry: EntryBrief | null;
}

export interface DrawRound {
  id: string;
  section: string;
  scopeKey: string;
  number: number;
  code: string;
  matchFormatId: string | null;
  matchFormat: { id: string; name: string; bestOf: number; pointsPerGame: number; winBy: number };
  matchFormatSource: 'ROUND' | 'DRAW' | 'SUB_EVENT';
}

export type SideSource =
  | { type: 'WINNER_OF'; matchNo: number }
  | { type: 'QUALIFIER'; index: number }
  | { type: 'GROUP_PLACE'; group: string; place: number };

export interface DrawMatch {
  id: string;
  matchNo: number;
  roundId: string;
  scopeKey: string;
  roundNumber: number;
  roundCode: string;
  section: string;
  groupId: string | null;
  orderInRound: number;
  side1: EntryBrief | null;
  side2: EntryBrief | null;
  side1Source: SideSource | null;
  side2Source: SideSource | null;
  status: 'SCHEDULED' | 'LIVE' | 'OFFICIAL';
  resultType: 'NORMAL' | 'WALKOVER' | 'RETIRED' | 'DISQUALIFIED' | 'BYE' | null;
  isVoided: boolean;
}

export interface BracketData extends DrawSummary {
  positions: BracketPosition[];
  rounds: DrawRound[];
  matches: DrawMatch[];
}

export interface GroupStanding {
  entryId: string;
  played: number;
  won: number;
  lost: number;
  matchPoints: number;
  gamesFor: number;
  gamesAgainst: number;
  rank: number | null;
  qualified: boolean;
  needsManualTiebreak: boolean;
  manualRank: number | null;
}

export interface GroupRecord {
  id: string;
  code: string;
  order: number;
  version: number;
  members: { entryId: string; slot: number; entry: EntryBrief }[];
  standings: GroupStanding[];
  matches: DrawMatch[];
}

export interface GroupsData extends DrawSummary {
  groups: GroupRecord[];
}

export interface DrawParams {
  kind: DrawKind;
  entryCount: number;
  seedCount: number | null;
  qualifierCount: number | null;
  groupCount: number | null;
  groupSize: number | null;
  advancePerGroup: number | null;
}

export interface DrawPreview {
  size: number | null;
  byeCount: number;
  seedCount: number;
  qualifierSlots: number;
  groupCount: number | null;
  sectionSizes: number[];
  params: DrawParams;
  defaults: { seedPercent: number; groupSize: number; advancePerGroup: number };
  existingDraw: { id: string; status: DrawStatus; version: number } | null;
}

export type DrawPreviewBody = Partial<Omit<DrawParams, 'entryCount'>> & { kind: DrawKind };

export interface Impact {
  type: 'WALKOVER' | 'VOID_MATCH' | 'REPLACE_SIDE' | 'STANDINGS_RECOMPUTE' | 'UNPUBLISH';
  matchId?: string;
  matchNo?: number;
  roundCode?: string;
  beneficiary?: EntryBrief;
  removed?: EntryBrief;
  added?: EntryBrief;
  groupCode?: string;
}

export interface DryRunResult {
  allowed: boolean;
  blockedCode?: string;
  impacts: Impact[];
}

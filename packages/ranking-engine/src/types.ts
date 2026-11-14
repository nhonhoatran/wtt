/** Calendar date as "YYYY-MM-DD"; strings avoid timezone drift for @db.Date columns. */
export type IsoDate = string;

export type DrawKind = 'QUALIFYING' | 'MAIN' | 'GROUP';
export type CompetitorKind = 'SINGLES' | 'DOUBLES';

export interface EngineMatch {
  drawKind: DrawKind;
  section: number;
  roundCode: string;
  roundNumber: number;
  status: string;
  resultType: string | null;
  winnerSide: number | null;
  isVoided: boolean;
  side1EntryId: string | null;
  side2EntryId: string | null;
}

export interface EngineGroupStanding {
  entryId: string;
  rank: number | null;
  qualified: boolean;
  /** Every non-voided match of the group is OFFICIAL. */
  complete: boolean;
}

export interface StageReached {
  drawKind: DrawKind;
  stageCode: string;
}

export interface StageOptions {
  groupStageByRank: boolean;
  awardPointsOnWalkoverLoss: boolean;
}

export interface PointsRule {
  eventTypeId: string;
  competitorKind: CompetitorKind;
  drawKind: DrawKind;
  stageCode: string;
  points: number;
  effectiveFrom: IsoDate;
}

export interface LedgerDraft {
  playerId: string;
  entryId: string;
  stageCode: string;
  points: number;
  ruleEffectiveFrom: IsoDate;
  earnedAt: IsoDate;
  expiresAt: IsoDate;
}

export interface LedgerRowInput {
  id: string;
  playerId: string;
  points: number;
  stageCode: string | null;
  earnedAt: IsoDate;
  expiresAt: IsoDate;
  eventSlug: string | null;
  eventName: string | null;
  eventNameEn: string | null;
  eventTypeCode: string | null;
}

export interface BreakdownItem {
  ledgerId: string;
  eventSlug: string | null;
  eventName: string | null;
  eventNameEn: string | null;
  eventTypeCode: string | null;
  stageCode: string | null;
  points: number;
  earnedAt: IsoDate;
  expiresAt: IsoDate;
}

export interface SnapshotRowDraft {
  playerId: string;
  rank: number;
  previousRank: number | null;
  movement: number | null;
  points: number;
  resultsCounted: number;
  breakdown: BreakdownItem[];
}

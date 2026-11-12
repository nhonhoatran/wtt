export type Gender = 'MALE' | 'FEMALE';
export type PlayerAction = 'LINK_PLAYER' | 'CREATE_PLAYER' | 'NEEDS_CONFIRM';

export interface RowPlayer {
  slot: 1 | 2;
  code: string | null;
  fullName: string;
  gender: Gender | null;
  birthYear: number | null;
  club: string | null;
  action: PlayerAction;
  playerId: string | null;
  newPlayerKey: string | null;
}

export interface RowData {
  subEventCode: string;
  subEventId: string | null;
  stage: 'MAIN' | 'QUALIFYING';
  quotaType: 'DIRECT' | 'WILDCARD' | 'QUALIFIER';
  /** False when the cell was blank: an update then keeps the stored value instead of the default. */
  stageGiven?: boolean;
  quotaTypeGiven?: boolean;
  seed: number | null;
  notes: string | null;
  players: RowPlayer[];
  /** Every message is an eligibility rule an ADMIN may override at commit. */
  overridable?: boolean;
}

export type RowStatus = 'VALID' | 'ERROR' | 'NEEDS_CONFIRM';

export interface EvaluatedRow {
  rowNo: number;
  status: RowStatus;
  plannedAction: 'CREATE_ENTRY' | 'UPDATE_ENTRY';
  data: RowData;
  messages: string[];
  /** Candidate player ids per slot ("1" / "2"), only for NEEDS_CONFIRM slots. */
  candidates: Record<string, string[]>;
}

export type Decisions = Partial<Record<'1' | '2', string>>;

/** Failure the operator must fix by uploading a corrected file; never retried. */
export class ImportFailure extends Error {}

import { QUOTA_EXPORT_LABELS } from '@kamito/shared';
import type { Gender } from '../../resources/players/player-labels';
import type { SubEventRecord } from './sub-event-labels';

export type EntryStatus = 'CONFIRMED' | 'WITHDRAWN';
export type EntryStage = 'MAIN' | 'QUALIFYING';
export type QuotaType = 'DIRECT' | 'WILDCARD' | 'QUALIFIER';
export type GenderRule = 'MEN' | 'WOMEN' | 'MIXED' | 'OPEN';

export interface EntrySubEvent extends SubEventRecord {
  discipline: SubEventRecord['discipline'] & { competitorKind: 'SINGLES' | 'DOUBLES'; genderRule: GenderRule };
}

export interface EntryPlayer {
  id: string;
  code: string;
  fullName: string;
  gender: Gender;
  birthYear: number | null;
  club: string | null;
}

export interface EntryRecord {
  id: string;
  subEventId: string;
  status: EntryStatus;
  stage: EntryStage;
  quotaType: QuotaType;
  seed: number | null;
  notes: string | null;
  eligibilityOverrideReason: string | null;
  rankingAtEntry: number | null;
  pointsAtEntry: number | null;
  createdAt: string;
  competitor: { id: string; type: 'PLAYER' | 'PAIR'; displayName: string; players: EntryPlayer[] };
}

export interface EntryCount {
  subEventId: string;
  confirmed: number;
  withdrawn: number;
}

/** Entry writes answer with non-blocking warnings (e.g. a draft draw that must be redrawn). */
export interface EntryWriteResult<T> {
  data: T;
  warnings?: string[];
}

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = { CONFIRMED: 'Đang tham gia', WITHDRAWN: 'Đã rút' };
export const ENTRY_STAGE_LABELS: Record<EntryStage, string> = { MAIN: 'Vòng chính', QUALIFYING: 'Vòng loại' };
/** Same words as the Excel template and export. */
export const QUOTA_LABELS: Record<QuotaType, string> = QUOTA_EXPORT_LABELS;

const optionsOf = <K extends string>(labels: Record<K, string>) =>
  (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));
export const ENTRY_STATUS_OPTIONS = optionsOf(ENTRY_STATUS_LABELS);
export const ENTRY_STAGE_OPTIONS = optionsOf(ENTRY_STAGE_LABELS);
export const QUOTA_OPTIONS = optionsOf(QUOTA_LABELS);

export const SUB_EVENT_QUERY_PARAM = 'subEvent';
export const DAY_QUERY_PARAM = 'day';
export const SESSION_QUERY_PARAM = 'session';
export const SIDE_MENU_WIDTH = 260;

export const isDoubles = (subEvent: EntrySubEvent) => subEvent.discipline.competitorKind === 'DOUBLES';

/** Lookup pre-filter: MEN → MALE, WOMEN → FEMALE; mixed and open sub-events search everyone. */
export function genderForRule(rule: GenderRule): Gender | undefined {
  if (rule === 'MEN') return 'MALE';
  if (rule === 'WOMEN') return 'FEMALE';
  return undefined;
}

export const entryCountsKey = (eventId: string) => ['admin-entry-counts', eventId];

export { showWarnings } from '../../api/write-warnings';

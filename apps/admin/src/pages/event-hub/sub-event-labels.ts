export type SubEventFormat = 'KNOCKOUT' | 'GROUP_KNOCKOUT';

export interface SubEventRecord {
  id: string;
  code: string;
  name: string | null;
  format: SubEventFormat;
  hasQualifying: boolean;
  maxEntries: number | null;
  matchFormatId: string;
  groupScoringRuleId: string | null;
  rankingListId: string | null;
  discipline: { id: string; code: string; name: string; competitorKind: 'SINGLES' | 'DOUBLES'; genderRule: 'MEN' | 'WOMEN' | 'MIXED' | 'OPEN' };
  category: { id: string; code: string; name: string } | null;
  matchFormat: { id: string; name: string };
  groupScoringRule: { id: string; name: string } | null;
  rankingList: { id: string; code: string; name: string } | null;
}

export const SUB_EVENT_FORMAT_LABELS: Record<SubEventFormat, string> = {
  KNOCKOUT: 'Loại trực tiếp',
  GROUP_KNOCKOUT: 'Vòng bảng + loại trực tiếp',
};
export const SUB_EVENT_FORMAT_OPTIONS = (Object.keys(SUB_EVENT_FORMAT_LABELS) as SubEventFormat[]).map((value) => ({
  value,
  label: SUB_EVENT_FORMAT_LABELS[value],
}));
/** Pre-selected when the form opens; the user can change it. */
export const DEFAULT_SUB_EVENT_FORMAT: SubEventFormat = 'KNOCKOUT';

export const subEventTitle = (row: Pick<SubEventRecord, 'name' | 'discipline' | 'category'>) =>
  row.name ?? (row.category ? `${row.discipline.name} – ${row.category.name}` : row.discipline.name);

export const subEventsKey = (eventId: string) => ['admin-sub-events', eventId];

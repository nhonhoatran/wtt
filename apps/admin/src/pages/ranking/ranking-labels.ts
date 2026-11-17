export { COMPETITOR_KIND_LABELS, COMPETITOR_KIND_OPTIONS, GENDER_RULE_LABELS, GENDER_RULE_OPTIONS } from '../../resources/disciplines/discipline-form';

export type PointsSource = 'AUTO' | 'MANUAL';
export type SnapshotStatus = 'DRAFT' | 'PUBLISHED';

export const POINTS_SOURCE_LABELS: Record<PointsSource, string> = { AUTO: 'Tự động', MANUAL: 'Thủ công' };
export const POINTS_SOURCE_COLORS: Record<PointsSource, string | undefined> = { AUTO: undefined, MANUAL: 'blue' };
export const POINTS_SOURCE_OPTIONS = (Object.keys(POINTS_SOURCE_LABELS) as PointsSource[]).map((value) => ({
  value,
  label: POINTS_SOURCE_LABELS[value],
}));

export const SNAPSHOT_STATUS_LABELS: Record<SnapshotStatus, string> = { DRAFT: 'Bản nháp', PUBLISHED: 'Đã công bố' };
export const SNAPSHOT_STATUS_COLORS: Record<SnapshotStatus, string | undefined> = { DRAFT: undefined, PUBLISHED: 'green' };
export const SNAPSHOT_STATUS_OPTIONS = (Object.keys(SNAPSHOT_STATUS_LABELS) as SnapshotStatus[]).map((value) => ({
  value,
  label: SNAPSHOT_STATUS_LABELS[value],
}));

export const POINTS_VALIDITY_OPTIONS = [
  { value: 'true', label: 'Còn hạn' },
  { value: 'false', label: 'Hết hạn' },
];


import type { DrawKind, DrawOverviewRow, DrawRef, DrawStatus, SideSource } from './draw-types';

export const DRAW_KIND_LABELS: Record<DrawKind, string> = { GROUP: 'Bảng đấu', QUALIFYING: 'Vòng loại', MAIN: 'Nhánh chính' };

/** Tag presets: draft stays the default grey, published green, structure locked blue. */
export const DRAW_STATUS_LABELS: Record<DrawStatus, string> = { DRAFT: 'Nháp', PUBLISHED: 'Đã công bố' };
export const DRAW_STATUS_COLORS: Record<DrawStatus, string | undefined> = { DRAFT: undefined, PUBLISHED: 'green' };
export const DRAW_LOCKED_LABEL = 'Đã khóa';

/** The engine only supports the winner alone or winner + runner-up per group (phase 06 spec). */
// Mirrors MIN_GROUP_SIZE in @kamito/competition-engine (structural, not a business value).
export const MIN_GROUP_SIZE = 3;

export const ADVANCE_PER_GROUP_OPTIONS = [
  { value: 1, label: 'Nhất bảng (1)' },
  { value: 2, label: 'Nhất và nhì bảng (2)' },
];

export const drawsOverviewKey = (eventId: string) => ['admin-event-draws', eventId];
export const DRAW_VIEW_KEY = 'admin-draw-view';
export const drawViewKey = (drawId: string | undefined) => [DRAW_VIEW_KEY, drawId];

export type OverallDrawState = 'NONE' | 'DRAFT' | 'PUBLISHED';

/** No draw yet, every draw published, or at least one draft left. */
export function overallDrawState(draws: DrawRef[] | undefined): OverallDrawState {
  if (!draws || draws.length === 0) return 'NONE';
  return draws.every((draw) => draw.status === 'PUBLISHED') ? 'PUBLISHED' : 'DRAFT';
}

export const OVERALL_LABELS: Record<OverallDrawState, string> = { NONE: 'Chưa bốc', DRAFT: 'Nháp', PUBLISHED: 'Đã công bố' };
export const OVERALL_COLORS: Record<OverallDrawState, string | undefined> = { NONE: undefined, DRAFT: undefined, PUBLISHED: 'green' };

export const overviewOf = (rows: DrawOverviewRow[] | undefined, subEventId: string) => rows?.find((row) => row.subEventId === subEventId);

/** F, SF, QF are named rounds; R64.. are "Vòng 64"; GR1.. are group matchdays; anything else is shown as the API sent it. */
export function roundTitle(code: string): string {
  const named: Record<string, string> = { F: 'Chung kết', SF: 'Bán kết', QF: 'Tứ kết' };
  if (named[code]) return named[code];
  const knockout = /^R(\d+)$/.exec(code);
  if (knockout) return `Vòng ${knockout[1]}`;
  const matchday = /^GR(\d+)$/.exec(code);
  if (matchday) return `Lượt ${matchday[1]}`;
  return code;
}

export function sideSourceLabel(source: SideSource | null): string {
  if (!source) return 'Chờ xác định';
  if (source.type === 'WINNER_OF') return `Thắng #${source.matchNo}`;
  if (source.type === 'QUALIFIER') return `Suất vòng loại ${source.index}`;
  const place = source.place === 1 ? 'Nhất' : source.place === 2 ? 'Nhì' : `Hạng ${source.place}`;
  return `${place} bảng ${source.group}`;
}

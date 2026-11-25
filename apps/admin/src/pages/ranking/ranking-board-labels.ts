export interface BoardPrevious {
  id: string;
  asOfDate: string;
  publishedAt: string | null;
}

export type MovementKind = 'new' | 'up' | 'down' | 'same' | 'none';

/** `none` = there is no previous period to compare with, so nothing can be said about movement. */
export function movementKind(movement: number | null, hasPrevious: boolean): MovementKind {
  if (!hasPrevious) return 'none';
  if (movement === null) return 'new';
  if (movement > 0) return 'up';
  if (movement < 0) return 'down';
  return 'same';
}

/** Points gained since the previous period; a newcomer's whole score counts as the gain. Null without a previous period. */
export function pointsDelta(points: number, previousPoints: number | null, hasPrevious: boolean): number | null {
  if (!hasPrevious) return null;
  return points - (previousPoints ?? 0);
}

export function formatDelta(delta: number | null): string {
  if (delta === null) return '—';
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${Math.abs(delta)}`;
  return '0';
}

const isoDay = (value: string) => value.slice(0, 10);

function formatDay(value: string): string {
  const [year, month, day] = isoDay(value).split('-');
  return `${day}/${month}/${year}`;
}

function formatTime(value: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(new Date(value));
}

interface SubtitleInput {
  status: 'DRAFT' | 'PUBLISHED';
  asOfDate: string;
  createdAt: string;
  publishedAt: string | null;
  previous: BoardPrevious | null;
  /** Defaults to the browser zone. */
  timeZone?: string;
}

/** "Bản tạm tính ngày … · tạo lúc … · Kỳ trước chốt ngày …" */
export function boardSubtitle({ status, asOfDate, createdAt, publishedAt, previous, timeZone }: SubtitleInput): string {
  const parts =
    status === 'DRAFT'
      ? [`Bản tạm tính ngày ${formatDay(asOfDate)}`, `tạo lúc ${formatTime(createdAt, timeZone)}`]
      : [`Đã chốt ngày ${formatDay(asOfDate)}`, ...(publishedAt ? [`lúc ${formatTime(publishedAt, timeZone)}`] : [])];
  parts.push(previous ? `Kỳ trước chốt ngày ${formatDay(previous.asOfDate)}` : 'Chưa có kỳ trước để so sánh');
  return parts.join(' · ');
}

interface PublishTextInput {
  listName: string;
  asOfDate: string;
  rows: number;
  changed: number;
  newcomers: number;
  hasPrevious: boolean;
}

/** Confirmation copy: what is about to be published and what can no longer be undone. */
export function publishConfirmLines({ listName, asOfDate, rows, changed, newcomers, hasPrevious }: PublishTextInput): string[] {
  const comparison = hasPrevious
    ? `So với kỳ trước: ${changed} VĐV đổi hạng, ${newcomers} VĐV mới.`
    : 'Đây là kỳ đầu tiên của bảng này, chưa có kỳ trước để so sánh.';
  return [
    `Bảng ${listName} ngày ${formatDay(asOfDate)} có ${rows} VĐV. ${comparison}`,
    'Sau khi chốt, bảng này hiện ngay trên trang công khai và trở thành kỳ trước của kỳ sau.',
    'Không thể sửa hay xóa bảng đã chốt.',
  ];
}

/** The list named in `?list=` when it exists, otherwise the first list (lists arrive ordered by `order`). */
export function resolveListId(param: string | null, listIds: readonly string[]): string | null {
  if (param && listIds.includes(param)) return param;
  return listIds[0] ?? null;
}

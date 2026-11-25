export type PendingDisplayStatus = 'LIVE' | 'OVERDUE' | 'UPCOMING';

export const PENDING_STATUS_LABELS: Record<PendingDisplayStatus, string> = {
  LIVE: 'Đang đấu',
  OVERDUE: 'Chờ kết quả',
  UPCOMING: 'Sắp đấu',
};

export const PENDING_STATUS_COLORS: Record<PendingDisplayStatus, string> = {
  LIVE: 'green',
  OVERDUE: 'gold',
  UPCOMING: 'blue',
};

/** Derived, never stored: a scheduled match past its start time is waiting for its result. */
export function pendingMatchStatus(match: { status: 'SCHEDULED' | 'LIVE'; scheduledAt: string | null }, nowMs: number): PendingDisplayStatus {
  if (match.status === 'LIVE') return 'LIVE';
  if (match.scheduledAt && Date.parse(match.scheduledAt) < nowMs) return 'OVERDUE';
  return 'UPCOMING';
}

/** "09:40" in the event timezone; "—" when the match has no time yet. */
export function matchTimeText(iso: string | null, timeZone: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('vi-VN', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

/** "Thứ Tư, 25/11/2026" for the page subtitle. */
export function todayText(now: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('vi-VN', { timeZone, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  const weekday = part('weekday').replace(/^./, (char) => char.toUpperCase());
  return `${weekday}, ${part('day')}/${part('month')}/${part('year')}`;
}

export function resultsLink(row: { eventId: string; id: string }): string {
  return `/results?event=${encodeURIComponent(row.eventId)}&match=${encodeURIComponent(row.id)}`;
}

import dayjs from 'dayjs';
import type { MatchListItem } from '../results/match-types';

export interface SessionTable {
  tableId: string;
  code: string;
  displayName: string | null;
  order: number;
}

export interface SessionRecord {
  id: string;
  eventId: string;
  venueId: string | null;
  date: string;
  code: string;
  name: string | null;
  nameEn: string | null;
  startTime: string;
  endTime: string | null;
  tables: SessionTable[];
  matchCount: number;
}

export type ScheduleConflict =
  | { kind: 'PLAYER_OVERLAP'; withMatchId: string; withMatchNo: number; playerId: string; playerName: string; gapMinutes: number }
  | { kind: 'TABLE_OVERLAP'; withMatchId: string; withMatchNo: number; tableId: string };

/** A match as the schedule screens see it: list item plus its slot. */
export interface ScheduleMatch extends MatchListItem {
  sessionId: string | null;
  tableId: string | null;
  tableCode: string | null;
  orderInSession: number | null;
  scheduledAt: string | null;
  scheduleVersion: number;
  conflicts?: ScheduleConflict[];
}

export interface ScheduleResponse {
  data: ScheduleMatch;
  swappedMatchId?: string;
  warnings?: string[];
}

export const scheduleKey = (eventId: string) => ['admin-schedule', eventId];
export const sessionsKey = (eventId: string) => ['admin-sessions', eventId];

export const tableLabel = (table: Pick<SessionTable, 'code' | 'displayName'>) => table.displayName ?? table.code;

export const sessionTimeRange = (session: Pick<SessionRecord, 'startTime' | 'endTime'>) =>
  session.endTime ? `${session.startTime}–${session.endTime}` : session.startTime;

export const sessionOptionLabel = (session: SessionRecord) => `${session.code} · ${sessionTimeRange(session)}`;

const SESSION_DATE_FORMAT = 'DD/MM';

/** For pickers that list sessions of every day: code, date and the session name (or its time range when unnamed). */
export const sessionDatedLabel = (session: SessionRecord) =>
  `${session.code} · ${dayjs(session.date).format(SESSION_DATE_FORMAT)} · ${session.name ?? sessionTimeRange(session)}`;

/** Today's YYYY-MM-DD in the event's timezone; the en-CA locale formats dates that way. */
export const todayInZone = (timeZone: string, now = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

/** Wall-clock time of an instant in the event's timezone (the browser may sit in another one). */
export function timeInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('vi-VN', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(dayjs(iso).toDate());
}

export const conflictText = (conflict: ScheduleConflict): string => {
  if (conflict.kind === 'TABLE_OVERLAP') return `Bàn trùng giờ với trận #${conflict.withMatchNo}`;
  return conflict.gapMinutes < 0
    ? `${conflict.playerName} trùng giờ với trận #${conflict.withMatchNo}`
    : `${conflict.playerName} có trận #${conflict.withMatchNo} cách ${conflict.gapMinutes} phút`;
};


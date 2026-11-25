import { gamesToWin } from '@kamito/competition-engine';
import { timeInZone } from '../event-hub/schedule-types';
import { matchTableLabel } from '../event-hub/table-display-name';
import type { MatchDetail } from './match-types';

/** "HH:mm, Thứ Tư 12/11/2025" in the event timezone. */
export function whenText(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('vi-VN', { timeZone, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  const weekday = part('weekday').replace(/^./, (char) => char.toUpperCase());
  return `${timeInZone(iso, timeZone)}, ${weekday} ${part('day')}/${part('month')}/${part('year')}`;
}

/** Table and time, then the rules of the match, all taken from the match data. */
export function matchInfoLine(detail: MatchDetail, timeZone: string): string {
  const table = matchTableLabel(detail);
  const place = [table, detail.scheduledAt ? whenText(detail.scheduledAt, timeZone) : null].filter(Boolean).join(' · ');
  const { bestOf, pointsPerGame, winBy } = detail.format;
  const rules = `Thắng ${gamesToWin(detail.format)}/${bestOf} ván · Ván ${pointsPerGame} điểm, cách ${winBy}`;
  return `${place || 'Chưa xếp lịch'} · ${rules}`;
}

import { createHash } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import { resolveAppSetting, tournamentSettings } from '@kamito/shared';
import { fieldError } from '../../common/validation/parse-body.js';
import { DURATION_SELECT, matchDurationMinutes } from './match-duration.js';
import type { AutoMatch, AutoSession } from './auto-schedule-types.js';

type Db = Pick<Prisma.TransactionClient, 'event' | 'eventSession' | 'match' | 'appSetting'>;
const PLAYER = { select: { id: true, fullName: true } } as const;
const ENTRY = { select: { id: true, status: true, competitor: { select: { id: true, player: PLAYER, pair: { select: { id: true, playerA: PLAYER, playerB: PLAYER } } } } } } as const;
const SELECT = {
  id: true, matchNo: true, version: true, scheduleVersion: true, status: true, resultType: true,
  winnerSide: true, isVoided: true, sessionId: true, tableId: true, orderInSession: true,
  scheduledAt: true, startedAt: true, officialAt: true, nextMatchId: true, nextMatchSide: true,
  side1Source: true, side2Source: true, side1Entry: ENTRY, side2Entry: ENTRY,
  ...DURATION_SELECT,
  round: { select: { number: true, matchFormat: { select: { estimatedMinutes: true } } } },
  draw: { select: { id: true, status: true, version: true, matchFormat: { select: { estimatedMinutes: true } } } },
} satisfies Prisma.MatchSelect;
type Row = Prisma.MatchGetPayload<{ select: typeof SELECT }>;

function side(entry: Row['side1Entry'], source: Prisma.JsonValue): AutoMatch['sides'][number] {
  const c = entry?.status === 'CONFIRMED' ? entry.competitor : null;
  const players = c?.player ? [c.player] : c?.pair ? [c.pair.playerA, c.pair.playerB] : [];
  const ref = source && typeof source === 'object' && !Array.isArray(source) ? source : null;
  return {
    players: players.map((p) => ({ id: p.id, name: p.fullName })),
    feederNo: entry && entry.status !== 'CONFIRMED' ? null : ref?.type === 'WINNER_OF' && typeof ref.matchNo === 'number' ? ref.matchNo : null,
  };
}

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]));
  return value;
}

export async function loadAutoSchedule(db: Db, eventId: string, sessionIds: string[]) {
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, timezone: true } });
  if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Không tìm thấy giải đấu' });
  const selection = [...new Set(sessionIds)].sort();
  const sessions = await db.eventSession.findMany({
    where: { eventId, id: { in: selection } }, orderBy: { id: 'asc' },
    select: { id: true, code: true, startTime: true, endTime: true, tables: { orderBy: [{ order: 'asc' }, { tableId: 'asc' }], select: { tableId: true, order: true, table: { select: { code: true } } } } },
  });
  if (sessions.length !== selection.length) throw fieldError('sessionIds', 'Buổi thi đấu không thuộc giải hoặc đã bị xóa');
  if (sessions.some((s) => !s.endTime || s.endTime <= s.startTime || !s.tables.length)) throw fieldError('sessionIds', 'Mỗi buổi cần giờ kết thúc sau giờ bắt đầu và ít nhất một bàn');
  if (sessions.reduce((sum, s) => sum + s.tables.length, 0) > 64) throw fieldError('sessionIds', 'Chọn tối đa 64 bàn mỗi lần gợi ý');
  const rows = await db.match.findMany({ where: { eventId }, orderBy: { id: 'asc' }, select: SELECT, take: 5001 });
  if (rows.length > 5000) throw fieldError('sessionIds', 'Gợi ý hiện hỗ trợ giải có tối đa 5.000 trận');
  const definitions = [tournamentSettings.scheduleMinRestMinutes, tournamentSettings.scheduleSessionMatchCap];
  const settings = await db.appSetting.findMany({ where: { key: { in: definitions.map((d) => d.key) } }, orderBy: { key: 'asc' } });
  const minRest = resolveAppSetting(tournamentSettings.scheduleMinRestMinutes, settings.find((s) => s.key === tournamentSettings.scheduleMinRestMinutes.key)?.value);
  const cap = resolveAppSetting(tournamentSettings.scheduleSessionMatchCap, settings.find((s) => s.key === tournamentSettings.scheduleSessionMatchCap.key)?.value);
  const matches: AutoMatch[] = rows.map((m) => ({
    id: m.id, matchNo: m.matchNo, round: m.round.number, status: m.status, resultType: m.resultType,
    isVoided: m.isVoided, published: m.draw.status === 'PUBLISHED', winnerSide: m.winnerSide, nextMatchId: m.nextMatchId,
    sessionId: m.sessionId, tableId: m.tableId, orderInSession: m.orderInSession,
    scheduledAt: m.scheduledAt?.getTime() ?? null, startedAt: m.startedAt?.getTime() ?? null, officialAt: m.officialAt?.getTime() ?? null,
    durationMinutes: matchDurationMinutes(m), sides: [side(m.side1Entry, m.side1Source), side(m.side2Entry, m.side2Source)],
  }));
  const selected: AutoSession[] = sessions.map((s) => ({ id: s.id, code: s.code, start: s.startTime.getTime(), end: s.endTime!.getTime(), tables: s.tables.map((t) => ({ id: t.tableId, code: t.table.code, order: t.order })) }));
  // Hash source data, including both optimistic versions and participant/source/config/duration changes.
  const fingerprint = createHash('sha256').update(JSON.stringify(canonical({ algorithm: 1, event, selection, sessions, rows, minRest, cap }))).digest('hex');
  return { matches, sessions: selected, minRest, cap, timeZone: event.timezone, fingerprint };
}

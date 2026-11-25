import { describe, expect, it } from 'vitest';
import { ongoingCandidateWhere, pickOngoing, todayMatchWhere } from './dashboard-today-window.js';

const date = (value: string) => new Date(`${value}T00:00:00Z`);
const event = (id: string, timezone: string, startDate: string, endDate: string, isCancelled = false) => ({
  id,
  timezone,
  startDate: date(startDate),
  endDate: date(endDate),
  isCancelled,
});

describe('pickOngoing', () => {
  // 2026-11-24T17:30Z is already 25 Nov in Ho Chi Minh (UTC+7) but still 24 Nov in Berlin (UTC+1 -> 18:30).
  const now = new Date('2026-11-24T17:30:00Z');

  it('judges each event against today in its own timezone around midnight', () => {
    const startsToday = event('vn', 'Asia/Ho_Chi_Minh', '2026-11-25', '2026-11-26');
    const startsTodayBerlin = event('de', 'Europe/Berlin', '2026-11-25', '2026-11-26');
    expect(pickOngoing([startsToday, startsTodayBerlin], now).map((e) => e.id)).toEqual(['vn']);
  });

  it('keeps the last day, drops finished, upcoming and cancelled events', () => {
    const picked = pickOngoing(
      [
        event('last-day', 'Asia/Ho_Chi_Minh', '2026-11-20', '2026-11-25'),
        event('done', 'Asia/Ho_Chi_Minh', '2026-11-20', '2026-11-24'),
        event('later', 'Asia/Ho_Chi_Minh', '2026-11-26', '2026-11-27'),
        event('cancelled', 'Asia/Ho_Chi_Minh', '2026-11-20', '2026-11-30', true),
      ],
      now,
    );
    expect(picked.map((e) => e.id)).toEqual(['last-day']);
  });
});

describe('ongoingCandidateWhere', () => {
  it('spans one day either side of the UTC date so no timezone is missed', () => {
    expect(ongoingCandidateWhere(new Date('2026-11-25T00:10:00Z'))).toEqual({
      isCancelled: false,
      startDate: { lte: date('2026-11-26') },
      endDate: { gte: date('2026-11-24') },
    });
  });
});

describe('todayMatchWhere', () => {
  const now = new Date('2026-11-24T17:30:00Z');

  it('groups events by their local date', () => {
    const where = todayMatchWhere(
      [
        { id: 'a', timezone: 'Asia/Ho_Chi_Minh' },
        { id: 'b', timezone: 'Asia/Bangkok' },
        { id: 'c', timezone: 'Europe/Berlin' },
      ],
      now,
    );
    const perDate = (where.AND as { OR?: unknown[] }[])[1]!.OR;
    expect(perDate).toEqual([
      { eventId: { in: ['a', 'b'] }, session: { date: date('2026-11-25') } },
      { eventId: { in: ['c'] }, session: { date: date('2026-11-24') } },
    ]);
  });

  it('excludes voided matches, byes and unpublished draws', () => {
    const where = todayMatchWhere([{ id: 'a', timezone: 'Asia/Ho_Chi_Minh' }], now);
    expect((where.AND as unknown[])[0]).toMatchObject({ isVoided: false, draw: { status: 'PUBLISHED' } });
  });
});

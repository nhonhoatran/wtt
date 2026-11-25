import { describe, expect, it } from 'vitest';
import { todayInTimezone } from '@kamito/shared';
import { dayRelation, eventDayCount, eventDayProgress } from '../../src/lib/event-day-progress';

describe('eventDayCount', () => {
  it('counts both ends and a single day', () => {
    expect(eventDayCount('2027-03-12', '2027-03-16')).toBe(5);
    expect(eventDayCount('2027-03-12', '2027-03-12')).toBe(1);
  });

  it('is not shifted by a DST change inside the range', () => {
    expect(eventDayCount('2027-03-13', '2027-03-15')).toBe(3);
    expect(eventDayCount('2027-10-30', '2027-11-01')).toBe(3);
  });

  it('spans month and year ends', () => {
    expect(eventDayCount('2026-12-30', '2027-01-02')).toBe(4);
  });
});

describe('eventDayProgress', () => {
  it('returns day x of y while the event runs', () => {
    expect(eventDayProgress('2027-03-12', '2027-03-16', '2027-03-12')).toEqual({ day: 1, total: 5 });
    expect(eventDayProgress('2027-03-12', '2027-03-16', '2027-03-14')).toEqual({ day: 3, total: 5 });
    expect(eventDayProgress('2027-03-12', '2027-03-16', '2027-03-16')).toEqual({ day: 5, total: 5 });
  });

  it('returns null outside the event', () => {
    expect(eventDayProgress('2027-03-12', '2027-03-16', '2027-03-11')).toBeNull();
    expect(eventDayProgress('2027-03-12', '2027-03-16', '2027-03-17')).toBeNull();
  });

  it('uses the event time zone for today, not the server zone', () => {
    const instant = new Date('2027-03-14T18:00:00Z');
    const hanoi = todayInTimezone('Asia/Ho_Chi_Minh', instant);
    const la = todayInTimezone('America/Los_Angeles', instant);
    expect(hanoi).toBe('2027-03-15');
    expect(la).toBe('2027-03-14');
    expect(eventDayProgress('2027-03-12', '2027-03-16', hanoi)?.day).toBe(4);
    expect(eventDayProgress('2027-03-12', '2027-03-16', la)?.day).toBe(3);
  });
});

describe('dayRelation', () => {
  it('labels past, today, tomorrow and later days', () => {
    expect(dayRelation('2027-03-13', '2027-03-14')).toBe('past');
    expect(dayRelation('2027-03-14', '2027-03-14')).toBe('today');
    expect(dayRelation('2027-03-15', '2027-03-14')).toBe('tomorrow');
    expect(dayRelation('2027-03-16', '2027-03-14')).toBe('later');
  });

  it('treats the day after a DST change as tomorrow', () => {
    expect(dayRelation('2027-03-15', '2027-03-14')).toBe('tomorrow');
    expect(dayRelation('2027-11-01', '2027-10-31')).toBe('tomorrow');
    expect(dayRelation('2027-01-01', '2026-12-31')).toBe('tomorrow');
  });
});

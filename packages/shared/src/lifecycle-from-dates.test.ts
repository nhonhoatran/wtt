import { describe, expect, it } from 'vitest';
import { lifecycleFromDates, todayInTimezone } from './lifecycle-from-dates.js';

const base = { startDate: '2026-12-01', endDate: '2026-12-03', isCancelled: false };

describe('lifecycleFromDates', () => {
  it('derives upcoming / ongoing / completed from the dates', () => {
    expect(lifecycleFromDates({ ...base, today: '2026-11-30' })).toBe('UPCOMING');
    expect(lifecycleFromDates({ ...base, today: '2026-12-01' })).toBe('ONGOING');
    expect(lifecycleFromDates({ ...base, today: '2026-12-03' })).toBe('ONGOING');
    expect(lifecycleFromDates({ ...base, today: '2026-12-04' })).toBe('COMPLETED');
  });

  it('reports cancelled regardless of dates', () => {
    expect(lifecycleFromDates({ ...base, isCancelled: true, today: '2026-12-02' })).toBe('CANCELLED');
  });
});

describe('todayInTimezone', () => {
  it('uses the calendar date of the given timezone', () => {
    const instant = new Date('2026-11-30T18:30:00Z');
    expect(todayInTimezone('Asia/Ho_Chi_Minh', instant)).toBe('2026-12-01');
    expect(todayInTimezone('UTC', instant)).toBe('2026-11-30');
  });
});

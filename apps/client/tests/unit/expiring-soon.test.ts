import { describe, expect, it } from 'vitest';
import { daysUntil, isExpiringSoon, todayIn } from '../../src/lib/expiring-soon';

describe('isExpiringSoon', () => {
  it('counts calendar days across month and year boundaries', () => {
    expect(daysUntil('2027-01-05', '2026-12-31')).toBe(5);
    expect(daysUntil('2026-03-01', '2026-02-27')).toBe(2);
  });

  it('is true inside the threshold, including both edges', () => {
    expect(isExpiringSoon('2026-12-25', '2026-11-25', 30)).toBe(true);
    expect(isExpiringSoon('2026-11-25', '2026-11-25', 30)).toBe(true);
  });

  it('is false beyond the threshold', () => {
    expect(isExpiringSoon('2026-12-26', '2026-11-25', 30)).toBe(false);
  });

  it('is false once expired', () => {
    expect(isExpiringSoon('2026-11-24', '2026-11-25', 30)).toBe(false);
  });

  it('is off when the threshold is 0 or invalid', () => {
    expect(isExpiringSoon('2026-11-26', '2026-11-25', 0)).toBe(false);
    expect(isExpiringSoon('2026-11-26', '2026-11-25', Number.NaN)).toBe(false);
  });

  it('ignores unparseable dates', () => {
    expect(isExpiringSoon('not-a-date', '2026-11-25', 30)).toBe(false);
  });

  it('accepts a full ISO timestamp by its date part', () => {
    expect(isExpiringSoon('2026-12-01T00:00:00.000Z', '2026-11-25', 30)).toBe(true);
  });
});

describe('todayIn', () => {
  const instant = new Date('2026-11-25T20:30:00Z');

  it('uses the calendar day of the given timezone, not UTC', () => {
    expect(todayIn('UTC', instant)).toBe('2026-11-25');
    expect(todayIn('Asia/Ho_Chi_Minh', instant)).toBe('2026-11-26');
    expect(todayIn('America/Los_Angeles', instant)).toBe('2026-11-25');
  });

  it('falls back to the UTC day for an invalid timezone', () => {
    expect(todayIn('Mars/Base', instant)).toBe('2026-11-25');
  });
});

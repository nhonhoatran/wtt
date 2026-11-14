import { describe, expect, it } from 'vitest';
import { PUBLIC_EVENT_STATUSES } from '@kamito/shared';
import { parsePublicChoice, parsePublicCode, parsePublicDate, parsePublicPage, parsePublicSearch, parsePublicYear, zonedDayRange } from './public-query-params.js';

describe('public query params', () => {
  it('falls back to page 1 for anything but a positive integer', () => {
    expect(parsePublicPage('3')).toBe(3);
    for (const raw of [undefined, '', '0', '-1', '1.5', 'abc', ['2', '3'], '99999999']) expect(parsePublicPage(raw)).toBe(1);
  });

  it('matches choices by own key only', () => {
    expect(parsePublicChoice('ongoing', PUBLIC_EVENT_STATUSES)).toBe('ONGOING');
    for (const raw of ['toString', '__proto__', 'ONGOING', ['ongoing'], undefined]) expect(parsePublicChoice(raw, PUBLIC_EVENT_STATUSES)).toBeUndefined();
  });

  it('accepts only code-shaped values, years in range and real dates', () => {
    expect(parsePublicCode('MS_U15-A')).toBe('MS_U15-A');
    expect(parsePublicCode('../x')).toBeUndefined();
    expect(parsePublicYear('2026')).toBe(2026);
    expect(parsePublicYear('1999')).toBeUndefined();
    expect(parsePublicDate('2026-02-28')).toBe('2026-02-28');
    expect(parsePublicDate('2026-02-30')).toBeUndefined();
    expect(parsePublicDate('2026-2-3')).toBeUndefined();
  });

  it('cuts long searches and normalizes diacritics', () => {
    expect(parsePublicSearch('  Nguyễn  Văn ')).toEqual({ text: 'Nguyễn  Văn', normalized: 'nguyen van' });
    expect(parsePublicSearch('x'.repeat(500))!.text).toHaveLength(100);
    expect(parsePublicSearch('   ')).toBeUndefined();
  });

  it('bounds a calendar day in the event time zone', () => {
    expect(zonedDayRange('2026-11-14', 'Asia/Ho_Chi_Minh')).toEqual({
      gte: new Date('2026-11-13T17:00:00.000Z'),
      lt: new Date('2026-11-14T17:00:00.000Z'),
    });
    expect(zonedDayRange('2026-11-14', 'UTC').gte).toEqual(new Date('2026-11-14T00:00:00.000Z'));
  });
});

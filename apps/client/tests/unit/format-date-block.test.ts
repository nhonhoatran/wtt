import { describe, expect, it } from 'vitest';
import { formatDateBlock } from '../../src/lib/format-date-block';

describe('formatDateBlock', () => {
  it('prints one day once', () => {
    expect(formatDateBlock('2027-03-05', '2027-03-05', 'en')).toEqual({ days: '05', period: 'Mar 2027' });
  });

  it('prints a range inside one month', () => {
    expect(formatDateBlock('2027-03-12', '2027-03-16', 'en')).toEqual({ days: '12–16', period: 'Mar 2027' });
  });

  it('names both months when the range crosses a month', () => {
    expect(formatDateBlock('2027-03-30', '2027-04-02', 'en')).toEqual({ days: '30–02', period: 'Mar – Apr 2027' });
  });

  it('names both years when the range crosses a year', () => {
    expect(formatDateBlock('2026-12-30', '2027-01-02', 'en').period).toBe('Dec 2026 – Jan 2027');
  });

  it('localises the month for Vietnamese', () => {
    expect(formatDateBlock('2027-03-12', '2027-03-16', 'vi').period).toMatch(/3 2027$/);
  });
});

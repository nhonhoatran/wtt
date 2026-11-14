import { describe, expect, it } from 'vitest';
import { dateFromIso, isoDateField, todayIso } from './iso-date-field.js';

describe('isoDateField', () => {
  it('accepts real calendar dates', () => {
    expect(isoDateField.safeParse('2096-02-29').success).toBe(true);
  });

  it.each(['2099-02-31', '2099-13-01', '99-01-01', '2099-1-1', '', 'not a date'])('rejects %s without throwing', (value) => {
    expect(isoDateField.safeParse(value).success).toBe(false);
  });

  it('round-trips through UTC midnight', () => {
    expect(dateFromIso('2099-05-02').toISOString()).toBe('2099-05-02T00:00:00.000Z');
    expect(todayIso(new Date('2099-05-02T23:59:59Z'))).toBe('2099-05-02');
  });
});

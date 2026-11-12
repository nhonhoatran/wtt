import { describe, expect, it } from 'vitest';
import { ageOnEvent, effectiveBirthYear } from './age-on-event.js';

const START = '2026-06-15';

describe('ageOnEvent', () => {
  it('BIRTH_YEAR ignores the birthday', () => {
    expect(ageOnEvent({ birthDate: '2010-12-31' }, START, 'BIRTH_YEAR')).toBe(16);
  });

  it('EVENT_START_DATE counts whole years on the start date', () => {
    expect(ageOnEvent({ birthDate: '2010-06-15' }, START, 'EVENT_START_DATE')).toBe(16);
    expect(ageOnEvent({ birthDate: '2010-06-16' }, START, 'EVENT_START_DATE')).toBe(15);
    expect(ageOnEvent({ birthDate: '2010-07-01' }, START, 'EVENT_START_DATE')).toBe(15);
    expect(ageOnEvent({ birthDate: '2010-01-01' }, START, 'EVENT_START_DATE')).toBe(16);
  });

  it('falls back to the birth year when only the year is known', () => {
    expect(ageOnEvent({ birthYear: 2010 }, START, 'EVENT_START_DATE')).toBe(16);
    expect(ageOnEvent({ birthYear: 2010 }, START, 'BIRTH_YEAR')).toBe(16);
  });

  it('returns null when nothing is known', () => {
    expect(ageOnEvent({}, START, 'BIRTH_YEAR')).toBeNull();
    expect(ageOnEvent({ birthDate: null, birthYear: null }, START, 'EVENT_START_DATE')).toBeNull();
  });

  it('prefers birthDate over birthYear', () => {
    expect(effectiveBirthYear({ birthDate: new Date('2009-03-02'), birthYear: 2010 })).toBe(2009);
  });
});

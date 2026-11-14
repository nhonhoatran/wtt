import { describe, expect, it } from 'vitest';
import { instantToHhmm, isHhmm, zonedTimeToInstant } from './session-time.js';

describe('session time helpers', () => {
  it('converts a Vietnam wall clock time to UTC and back', () => {
    const instant = zonedTimeToInstant('2026-11-20', '08:30', 'Asia/Ho_Chi_Minh');
    expect(instant.toISOString()).toBe('2026-11-20T01:30:00.000Z');
    expect(instantToHhmm(instant, 'Asia/Ho_Chi_Minh')).toBe('08:30');
  });

  it('handles zones behind UTC and the previous calendar day', () => {
    const instant = zonedTimeToInstant('2026-07-01', '20:15', 'America/New_York');
    expect(instant.toISOString()).toBe('2026-07-02T00:15:00.000Z');
    expect(instantToHhmm(instant, 'America/New_York')).toBe('20:15');
  });

  it('validates HH:mm', () => {
    expect(['00:00', '23:59', '08:05'].every(isHhmm)).toBe(true);
    expect(['24:00', '8:05', '12:60', ''].some(isHhmm)).toBe(false);
  });
});

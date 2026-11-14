import { describe, expect, it } from 'vitest';
import { isValidSlug, slugifyVietnamese } from './slugify-vietnamese.js';

describe('slugifyVietnamese', () => {
  it('strips Vietnamese diacritics including đ/Đ', () => {
    expect(slugifyVietnamese('Giải Vô địch Đơn nam 2026')).toBe('giai-vo-dich-don-nam-2026');
    expect(slugifyVietnamese('Đà Nẵng mở rộng')).toBe('da-nang-mo-rong');
  });

  it('collapses punctuation and trims dashes', () => {
    expect(slugifyVietnamese('  --Kamito Cup!! (Lần 3) -- ')).toBe('kamito-cup-lan-3');
  });

  it('truncates without leaving a trailing dash', () => {
    expect(slugifyVietnamese('abc def ghi', 4)).toBe('abc');
  });

  it('returns an empty string when nothing is left', () => {
    expect(slugifyVietnamese('!!!')).toBe('');
  });

  it('validates slugs', () => {
    expect(isValidSlug('kamito-cup-2026')).toBe(true);
    expect(isValidSlug('Kamito')).toBe(false);
    expect(isValidSlug('a--b')).toBe(false);
    expect(isValidSlug('')).toBe(false);
  });

  it('rejects reserved slugs that would shadow a public route', () => {
    expect(isValidSlug('calendar')).toBe(false);
    expect(isValidSlug('calendar-2026')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { cleanPersonName, normalizePersonName } from './normalize-person-name.js';
import { stripDiacritics } from './strip-diacritics.js';

describe('normalizePersonName', () => {
  it('lowercases and removes diacritics', () => {
    expect(normalizePersonName('Nguyễn Văn Ánh')).toBe('nguyen van anh');
  });

  it('maps đ and Đ to d', () => {
    expect(normalizePersonName('Đặng Đình Đức')).toBe('dang dinh duc');
    expect(stripDiacritics('Đỗ đạt')).toBe('Do dat');
  });

  it('collapses and trims extra whitespace', () => {
    expect(normalizePersonName('  Trần   Thị \t Mai  ')).toBe('tran thi mai');
    expect(cleanPersonName('  Trần   Thị  Mai ')).toBe('Trần Thị Mai');
  });

  it('treats decomposed and composed input the same', () => {
    expect(normalizePersonName('Nguyễn An')).toBe(normalizePersonName('Nguyễn An'));
  });

  it('works for names that are already plain ASCII', () => {
    expect(normalizePersonName('John Smith')).toBe('john smith');
  });
});

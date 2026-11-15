import { describe, expect, it } from 'vitest';
import { PUBLIC_URL_PART_PATTERN } from './public-api.js';

describe('public URL parts shared by API and server-rendered client', () => {
  it('supports every catalog code shape, including composed sub-event codes', () => {
    for (const code of ['MS', '_MS', '-MS', `${'D'.repeat(40)}-${'C'.repeat(40)}`, 'x'.repeat(128)]) expect(PUBLIC_URL_PART_PATTERN.test(code)).toBe(true);
  });

  it('rejects traversal, URL delimiters and values outside the technical bound', () => {
    for (const value of ['', '.', '..', '../MS', '%2e%2e', 'MS/MD', 'MS?kind=main', 'MS#MD', ' MS', 'x'.repeat(129)]) expect(PUBLIC_URL_PART_PATTERN.test(value)).toBe(false);
  });
});

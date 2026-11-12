import { describe, expect, it } from 'vitest';
import { httpsUrlSchema, isHttpsUrl, optionalHttpsUrlSchema } from './https-url.js';

describe('isHttpsUrl', () => {
  it('accepts https URLs', () => {
    expect(isHttpsUrl('https://ve.kamito.vn/giai-2026?ref=1')).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'http://example.com',
    'data:text/html,<script>alert(1)</script>',
    '//example.com',
    'https://user:pass@example.com',
    'https://exa mple.com',
    'https://example.com/\x00',
    'java\tscript:alert(1)',
    'ftp://example.com',
    '',
  ])('rejects %s', (value) => {
    expect(isHttpsUrl(value)).toBe(false);
  });
});

describe('optionalHttpsUrlSchema', () => {
  it('maps empty input to null', () => {
    expect(optionalHttpsUrlSchema.parse('')).toBeNull();
    expect(optionalHttpsUrlSchema.parse(null)).toBeNull();
    expect(optionalHttpsUrlSchema.parse(undefined)).toBeUndefined();
  });

  it('rejects non-https values and trims https ones', () => {
    expect(optionalHttpsUrlSchema.safeParse('http://x.vn').success).toBe(false);
    expect(httpsUrlSchema.parse(' https://x.vn ')).toBe('https://x.vn');
  });
});

import { describe, expect, it } from 'vitest';
import { effectiveMaxImageBytes, incomingKeyFor, parseVariantWidths, publicKeyFor, publicUrlFor } from './media-contract.js';

describe('media contract', () => {
  it('caps the admin setting by the server ceiling', () => {
    expect(effectiveMaxImageBytes(5, 10 * 1024 * 1024)).toBe(5 * 1024 * 1024);
    expect(effectiveMaxImageBytes(50, 5 * 1024 * 1024)).toBe(5 * 1024 * 1024);
  });

  it('parses variant widths sorted and unique, rejecting junk', () => {
    expect(parseVariantWidths(['1280', '320', '640', '320'])).toEqual([320, 640, 1280]);
    expect(() => parseVariantWidths(['320', 'x'])).toThrow();
    expect(() => parseVariantWidths([])).toThrow();
    expect(() => parseVariantWidths(['0'])).toThrow();
  });

  it('builds keys and urls', () => {
    expect(incomingKeyFor('tier-logo', 'u1')).toBe('incoming/tier-logo/u1');
    expect(publicKeyFor('event-banner', 'u1', 640, new Date('2026-11-12T00:00:00Z'))).toBe('public/event-banner/2026/u1-640.webp');
    expect(publicUrlFor('https://cdn.example/media/', 'public/event-banner/2026/u1-640.webp')).toBe(
      'https://cdn.example/media/event-banner/2026/u1-640.webp',
    );
  });
});

import { tokens } from '@kamito/ui-tokens';
import { describe, expect, it } from 'vitest';
import { contrastRatio, isHexColor, readableTextColor } from '../../src/lib/readable-text-color';

describe('readableTextColor', () => {
  it('picks ink on white and white on navy', () => {
    expect(readableTextColor('#FFFFFF')).toBe(tokens.color.ink);
    expect(readableTextColor('#0F285D')).toBe(tokens.color.surface);
  });

  it('picks whichever side has the higher contrast for the brand red', () => {
    const picked = readableTextColor('#EC1E24');
    const other = picked === tokens.color.ink ? tokens.color.surface : tokens.color.ink;
    expect(contrastRatio('#EC1E24', picked)).toBeGreaterThanOrEqual(contrastRatio('#EC1E24', other));
  });

  it('accepts lower-case hex', () => {
    expect(readableTextColor('#0f285d')).toBe(tokens.color.surface);
  });

  it('falls back to ink for malformed values', () => {
    for (const value of ['', 'red', '#FFF', '#GGGGGG', 'url(x)', '#FFFFFF;x']) {
      expect(readableTextColor(value)).toBe(tokens.color.ink);
    }
  });

  it('validates #RRGGBB only', () => {
    expect(isHexColor('#a1B2c3')).toBe(true);
    expect(isHexColor('a1B2c3')).toBe(false);
    expect(isHexColor('#a1B2c')).toBe(false);
  });

  it('keeps the new token pairs readable', () => {
    const { color } = tokens;
    expect(contrastRatio(color.primaryText, color.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(color.success, color.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(color.successOnDark, color.data)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(color.dangerOnDark, color.data)).toBeGreaterThanOrEqual(4.5);
  });
});

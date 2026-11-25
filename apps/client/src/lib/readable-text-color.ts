import { tokens } from '@kamito/ui-tokens';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

function channel(hex: string, start: number): number {
  const value = parseInt(hex.slice(start, start + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/** White or ink, whichever reads better on the given background. Malformed input falls back to ink. */
export function readableTextColor(background: string): string {
  if (!isHexColor(background)) return tokens.color.ink;
  const onWhite = contrastRatio(background, tokens.color.surface);
  const onInk = contrastRatio(background, tokens.color.ink);
  return onWhite > onInk ? tokens.color.surface : tokens.color.ink;
}

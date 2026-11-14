import type { DrawKind } from './types.js';

const FRAMES: Record<DrawKind, string[]> = {
  MAIN: ['W', 'F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128'],
  QUALIFYING: ['QF-1', 'QF-2', 'QF-3', 'QF-4'],
  GROUP: ['GROUP', ...Array.from({ length: 8 }, (_, i) => `GROUP-${i + 1}`)],
};

function codeOrder(code: string): number {
  const digits = /(\d+)$/.exec(code);
  return digits ? Number(digits[1]) : 0;
}

/** Rows of the rules matrix: standard frame first, then codes already stored in rules that fall outside it. */
export function stageCodeRows(drawKind: DrawKind, existingCodes: Iterable<string>): string[] {
  const frame = FRAMES[drawKind];
  const known = new Set(frame);
  const extra = [...new Set(existingCodes)].filter((code) => !known.has(code));
  extra.sort((a, b) => codeOrder(a) - codeOrder(b) || a.localeCompare(b));
  return [...frame, ...extra];
}

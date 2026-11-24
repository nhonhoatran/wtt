import { describe, expect, it } from 'vitest';
import type { PublicBracketMatch, PublicBracketRound } from '@kamito/shared';
import { printBracketPages } from '../../src/components/bracket/print-bracket-pages';

function roundsFor(size: number): PublicBracketRound[] {
  let number = 0;
  return Array.from({ length: Math.log2(size) }, (_, index) => ({
    number: index + 1,
    code: `R${size / 2 ** index}`,
    matches: Array.from({ length: size / 2 ** (index + 1) }, (_, i) => ({
      matchNo: ++number, orderInRound: i + 1,
    } as PublicBracketMatch)),
  }));
}

describe('print-only bracket pagination', () => {
  for (const size of [2, 8, 16, 32, 64, 128, 256]) {
    it(`preserves every match exactly once for a ${size}-slot draw without mutating the screen rounds`, () => {
      const rounds = roundsFor(size);
      const before = structuredClone(rounds);
      const pages = printBracketPages(rounds);
      const ids = pages.flatMap((page) => page.flatMap((round) => round.matches.map((match) => match.matchNo)));
      expect(ids.toSorted((a, b) => a - b)).toEqual(Array.from({ length: size - 1 }, (_, i) => i + 1));
      expect(rounds).toEqual(before);
      expect(pages.every((page) => page[0]!.matches.length <= 8)).toBe(true);
      if (size === 64) {
        expect(pages.map((page) => page.map((round) => round.matches.length))).toEqual([
          [8, 4, 2, 1], [8, 4, 2, 1], [8, 4, 2, 1], [8, 4, 2, 1], [2, 1],
        ]);
        expect(pages[0]![0]!.matches[0]).toBe(rounds[0]!.matches[0]);
        expect(pages[4]![0]!.matches[0]).toBe(rounds[4]!.matches[0]);
      }
    });
  }

  it('keeps empty or irregular published data intact', () => {
    expect(printBracketPages([])).toEqual([[]]);
    const irregular = roundsFor(64);
    irregular[1]!.matches.pop();
    expect(printBracketPages(irregular)).toEqual([irregular]);
  });
});

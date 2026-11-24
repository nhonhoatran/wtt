import type { PublicBracketRound } from '@kamito/shared';

// Paper geometry, not a tournament rule: eight opening matches keep long doubles names readable on A4.
const OPENING_MATCHES_PER_SHEET = 8;

/** Keep each subtree together; later rounds retain their original match numbers and feeder labels. */
export function printBracketPages(rounds: PublicBracketRound[]): PublicBracketRound[][] {
  const count = rounds[0]?.matches.length ?? 0;
  if (count <= OPENING_MATCHES_PER_SHEET) return [rounds];
  // Irregular published data must remain intact rather than silently dropping a match.
  if (!rounds.every((round, index) => round.matches.length === count / 2 ** index)) return [rounds];
  const levels = Math.log2(OPENING_MATCHES_PER_SHEET) + 1;
  const pages: PublicBracketRound[][] = [];
  for (let offset = 0; offset < count; offset += OPENING_MATCHES_PER_SHEET) {
    pages.push(rounds.slice(0, levels).map((round, index) => ({
      ...round,
      matches: round.matches.slice(offset / 2 ** index, (offset + OPENING_MATCHES_PER_SHEET) / 2 ** index),
    })));
  }
  if (rounds.length > levels) pages.push(...printBracketPages(rounds.slice(levels)));
  return pages;
}

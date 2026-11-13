import type { RoundStyle } from './types.js';

const NAMED_ROUNDS: Record<number, string> = { 2: 'F', 4: 'SF', 8: 'QF' };

/** `participants` = number of slots playing in that round (2 = final). */
export function knockoutRoundCode(participants: number): string {
  return NAMED_ROUNDS[participants] ?? `R${participants}`;
}

/** Counted back from the section final so sections of different size share codes: QF-1 is always the decider. */
export function qualifyingRoundCode(roundsFromFinal: number): string {
  return `QF-${roundsFromFinal}`;
}

export function groupRoundCode(roundNumber: number): string {
  return `GR${roundNumber}`;
}

export function roundCode(style: RoundStyle, participants: number, roundsFromFinal: number): string {
  return style === 'QUALIFYING' ? qualifyingRoundCode(roundsFromFinal) : knockoutRoundCode(participants);
}

import type { Prisma } from '@kamito/db';

export const FORMAT_SELECT = { select: { id: true, name: true, bestOf: true, pointsPerGame: true, winBy: true } } as const;

export const DRAW_INCLUDE = {
  matchFormat: FORMAT_SELECT,
  subEvent: { select: { id: true, code: true, eventId: true, matchFormat: FORMAT_SELECT } },
} satisfies Prisma.DrawInclude;

type FormatRow = { id: string; name: string; bestOf: number; pointsPerGame: number; winBy: number };

/** Round format: round override, else draw override, else the sub-event default. */
export function formatOf(round: { matchFormat: FormatRow | null }, draw: { matchFormat: FormatRow | null; subEvent: { matchFormat: FormatRow } }) {
  if (round.matchFormat) return { matchFormat: round.matchFormat, matchFormatSource: 'ROUND' as const };
  if (draw.matchFormat) return { matchFormat: draw.matchFormat, matchFormatSource: 'DRAW' as const };
  return { matchFormat: draw.subEvent.matchFormat, matchFormatSource: 'SUB_EVENT' as const };
}

/** The one precedence rule for a match's format: round override, else draw override, else the sub-event default. */
export const pickMatchFormat = <F>(round: { matchFormat: F | null }, draw: { matchFormat: F | null }, subEvent: { matchFormat: F }): F =>
  round.matchFormat ?? draw.matchFormat ?? subEvent.matchFormat;

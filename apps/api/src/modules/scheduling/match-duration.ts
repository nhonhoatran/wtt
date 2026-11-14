import type { Prisma } from '@kamito/db';

const MINUTES = { select: { matchFormat: { select: { estimatedMinutes: true } } } } as const;

export const DURATION_SELECT = { round: MINUTES, draw: MINUTES, subEvent: MINUTES } satisfies Prisma.MatchSelect;

type DurationRow = Prisma.MatchGetPayload<{ select: typeof DURATION_SELECT }>;

/** Round overrides draw, draw overrides sub-event, same as the score validator's format. */
export const matchDurationMinutes = (m: DurationRow): number =>
  (m.round.matchFormat ?? m.draw.matchFormat ?? m.subEvent.matchFormat).estimatedMinutes;

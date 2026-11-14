import type { Prisma } from '@kamito/db';
import { pickMatchFormat } from '../draws/round-format-view.js';

const MINUTES = { select: { matchFormat: { select: { estimatedMinutes: true } } } } as const;

export const DURATION_SELECT = { round: MINUTES, draw: MINUTES, subEvent: MINUTES } satisfies Prisma.MatchSelect;

type DurationRow = Prisma.MatchGetPayload<{ select: typeof DURATION_SELECT }>;

export const matchDurationMinutes = (m: DurationRow): number => pickMatchFormat(m.round, m.draw, m.subEvent).estimatedMinutes;

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import { tournamentSettings } from '@kamito/shared';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DURATION_SELECT, matchDurationMinutes } from './match-duration.js';
import { computeScheduleConflicts, type ConflictSideInput, type ScheduleConflict } from './schedule-conflict.js';

const PLAYER = { select: { id: true, fullName: true } } as const;
const SIDE = { select: { competitor: { select: { player: PLAYER, pair: { select: { playerA: PLAYER, playerB: PLAYER } } } } } } as const;

const SCHEDULED_MATCH_SELECT = {
  id: true,
  matchNo: true,
  tableId: true,
  scheduledAt: true,
  ...DURATION_SELECT,
  side1Entry: SIDE,
  side2Entry: SIDE,
} satisfies Prisma.MatchSelect;

type ScheduledRow = Prisma.MatchGetPayload<{ select: typeof SCHEDULED_MATCH_SELECT }>;

function toInput(m: ScheduledRow): ConflictSideInput {
  const players = [m.side1Entry, m.side2Entry].flatMap((entry) => {
    const c = entry?.competitor;
    return c?.player ? [c.player] : c?.pair ? [c.pair.playerA, c.pair.playerB] : [];
  });
  return {
    matchId: m.id,
    matchNo: m.matchNo,
    tableId: m.tableId,
    startsAt: m.scheduledAt as Date,
    durationMinutes: matchDurationMinutes(m),
    players: players.map((p) => ({ id: p.id, name: p.fullName })),
  };
}

@Injectable()
export class ScheduleConflictService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
  ) {}

  /** Conflicts of every scheduled match of the event, keyed by match id; matches without conflicts are absent. */
  async forEvent(eventId: string): Promise<Map<string, ScheduleConflict[]>> {
    const [rows, minRest] = await Promise.all([
      this.prisma.match.findMany({
        where: { eventId, sessionId: { not: null }, scheduledAt: { not: null }, isVoided: false },
        select: SCHEDULED_MATCH_SELECT,
      }),
      this.settings.get(tournamentSettings.scheduleMinRestMinutes),
    ]);
    return computeScheduleConflicts(rows.map(toInput), minRest);
  }
}

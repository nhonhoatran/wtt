export interface ConflictSideInput {
  matchId: string;
  matchNo: number;
  tableId: string | null;
  startsAt: Date;
  durationMinutes: number;
  players: { id: string; name: string }[];
}

export type ScheduleConflict =
  | { kind: 'PLAYER_OVERLAP'; withMatchId: string; withMatchNo: number; playerId: string; playerName: string; gapMinutes: number }
  | { kind: 'TABLE_OVERLAP'; withMatchId: string; withMatchNo: number; tableId: string };

const MINUTE_MS = 60_000;

/**
 * Pure conflict detection over scheduled matches. A player conflicts when the gap between two of their
 * matches is below `minRestMinutes` (negative gap = real overlap); a table conflicts only on real overlap.
 */
export function computeScheduleConflicts(matches: ConflictSideInput[], minRestMinutes: number): Map<string, ScheduleConflict[]> {
  const result = new Map<string, ScheduleConflict[]>();
  const push = (id: string, conflict: ScheduleConflict) => (result.get(id) ?? result.set(id, []).get(id)!).push(conflict);
  const sorted = [...matches].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.matchNo - b.matchNo);
  const endOf = (m: ConflictSideInput) => m.startsAt.getTime() + m.durationMinutes * MINUTE_MS;
  const rest = minRestMinutes * MINUTE_MS;

  for (const [i, a] of sorted.entries()) {
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j]!;
      if (b.startsAt.getTime() >= endOf(a) + rest) break;
      const gapMinutes = Math.round((b.startsAt.getTime() - endOf(a)) / MINUTE_MS);
      for (const player of a.players) {
        const other = b.players.find((p) => p.id === player.id);
        if (!other) continue;
        push(a.matchId, { kind: 'PLAYER_OVERLAP', withMatchId: b.matchId, withMatchNo: b.matchNo, playerId: player.id, playerName: player.name, gapMinutes });
        push(b.matchId, { kind: 'PLAYER_OVERLAP', withMatchId: a.matchId, withMatchNo: a.matchNo, playerId: player.id, playerName: player.name, gapMinutes });
      }
      if (a.tableId && a.tableId === b.tableId && b.startsAt.getTime() < endOf(a)) {
        push(a.matchId, { kind: 'TABLE_OVERLAP', withMatchId: b.matchId, withMatchNo: b.matchNo, tableId: a.tableId });
        push(b.matchId, { kind: 'TABLE_OVERLAP', withMatchId: a.matchId, withMatchNo: a.matchNo, tableId: a.tableId });
      }
    }
  }
  return result;
}

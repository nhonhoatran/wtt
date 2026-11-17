import { competitionRank } from './competition-rank.js';
import type { BreakdownItem, IsoDate, LedgerRowInput, SnapshotRowDraft } from './types.js';

export interface BuildSnapshotInput {
  ledger: LedgerRowInput[];
  asOf: IsoDate;
  playerNames: ReadonlyMap<string, string>;
  /** playerId -> rank in the latest published snapshot of the same list. */
  previousRanks: ReadonlyMap<string, number>;
}

function toBreakdown(row: LedgerRowInput): BreakdownItem {
  return {
    ledgerId: row.id,
    eventId: row.eventId,
    eventSlug: row.eventSlug,
    eventName: row.eventName,
    eventNameEn: row.eventNameEn,
    eventTypeCode: row.eventTypeCode,
    stageCode: row.stageCode,
    points: row.points,
    earnedAt: row.earnedAt,
    expiresAt: row.expiresAt,
  };
}

export function buildSnapshotRows(input: BuildSnapshotInput): SnapshotRowDraft[] {
  const byPlayer = new Map<string, LedgerRowInput[]>();
  for (const row of input.ledger) {
    if (row.earnedAt > input.asOf || row.expiresAt <= input.asOf) continue;
    const list = byPlayer.get(row.playerId);
    if (list) list.push(row);
    else byPlayer.set(row.playerId, [row]);
  }

  const candidates = [...byPlayer].map(([playerId, rows]) => ({
    playerId,
    total: rows.reduce((sum, r) => sum + r.points, 0),
    counted: rows.length,
    fullName: input.playerNames.get(playerId) ?? '',
  }));

  return competitionRank(candidates).map((c) => {
    const previousRank = input.previousRanks.get(c.playerId) ?? null;
    const rows = [...byPlayer.get(c.playerId)!].sort((a, b) => b.points - a.points);
    return {
      playerId: c.playerId,
      rank: c.rank,
      previousRank,
      movement: previousRank === null ? null : previousRank - c.rank,
      points: c.total,
      resultsCounted: c.counted,
      breakdown: rows.map(toBreakdown),
    };
  });
}

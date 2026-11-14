export interface SeedSourceRow {
  rank: number;
  points: number;
}

export interface EntrySeedValue {
  rankingAtEntry: number | null;
  pointsAtEntry: number;
}

/** Singles keep the player's own rank; pairs sum both players' points and carry no rank. Unranked players count 0. */
export function seedValueForEntry(
  playerIds: string[],
  rowsByPlayer: ReadonlyMap<string, SeedSourceRow>,
): EntrySeedValue {
  const rows = playerIds.map((id) => rowsByPlayer.get(id));
  const pointsAtEntry = rows.reduce((sum, row) => sum + (row?.points ?? 0), 0);
  const rankingAtEntry = playerIds.length === 1 ? (rows[0]?.rank ?? null) : null;
  return { rankingAtEntry, pointsAtEntry };
}

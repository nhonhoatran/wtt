import type { MatchData } from '@kamito/competition-engine';
import type { Prisma } from '@kamito/db';
import { jsonOrNull, sameJson, toStoredSource } from './draw-source-json.js';
import { markWalkoverForEntry, settleDeferredWalkover } from './knockout-walkover.js';

type Tx = Prisma.TransactionClient;

/**
 * full: draft edit, matches are rewritten to the derived state (BYE results included). Pending walkover
 * markers are dropped and re-applied to the same withdrawn entries wherever they now sit; settled at publish.
 * fill: published draw, only empty sides get an entry; results already entered are never touched.
 * A withdrawn entry that is filled in (late qualifier) immediately loses to its opponent.
 */
export type SyncMode = 'full' | 'fill';

/**
 * Applies the output of deriveMatches to existing rows of one scope in place, so matchNo, match ids
 * and round format overrides stay stable. Only rows that actually differ are written.
 */
export async function syncDerivedMatches(tx: Tx, drawId: string, scopeKey: string, derived: readonly MatchData[], mode: SyncMode): Promise<number> {
  const existing = await tx.match.findMany({
    where: { drawId, round: { scopeKey } },
    select: {
      id: true,
      matchNo: true,
      orderInRound: true,
      side1EntryId: true,
      side2EntryId: true,
      side1Source: true,
      side2Source: true,
      status: true,
      resultType: true,
      winnerSide: true,
      round: { select: { number: true } },
    },
  });
  const byKey = new Map(existing.map((row) => [`${row.round.number}:${row.orderInRound}`, row]));
  const matchNoOf = (ref: { roundNumber: number; orderInRound: number }) => byKey.get(`${ref.roundNumber}:${ref.orderInRound}`)!.matchNo;

  const carried = mode === 'full' ? pendingWalkoverLosers(existing) : [];
  const filledEntries = new Set<string>();
  let updated = 0;
  const filled: string[] = [];
  for (const match of derived) {
    const row = byKey.get(`${match.roundNumber}:${match.orderInRound}`);
    if (!row) continue;
    const data: Prisma.MatchUncheckedUpdateInput = {};

    if (mode === 'fill') {
      for (const side of [1, 2] as const) {
        const wanted = side === 1 ? match.side1EntryId : match.side2EntryId;
        const current = side === 1 ? row.side1EntryId : row.side2EntryId;
        if (!wanted || current) continue;
        data[side === 1 ? 'side1EntryId' : 'side2EntryId'] = wanted;
        filledEntries.add(wanted);
        data[side === 1 ? 'side1Source' : 'side2Source'] = jsonOrNull(undefined);
      }
    } else {
      const side1Source = toStoredSource(match.side1Source, matchNoOf);
      const side2Source = toStoredSource(match.side2Source, matchNoOf);
      if ((match.side1EntryId ?? null) !== row.side1EntryId) data.side1EntryId = match.side1EntryId ?? null;
      if ((match.side2EntryId ?? null) !== row.side2EntryId) data.side2EntryId = match.side2EntryId ?? null;
      if (!sameJson(side1Source, row.side1Source)) data.side1Source = jsonOrNull(side1Source);
      if (!sameJson(side2Source, row.side2Source)) data.side2Source = jsonOrNull(side2Source);
      if (match.bye) {
        if (row.resultType !== 'BYE' || row.winnerSide !== match.bye.winnerSide || row.status !== 'OFFICIAL') {
          Object.assign(data, { status: 'OFFICIAL', resultType: 'BYE', winnerSide: match.bye.winnerSide });
        }
      } else if (row.resultType === 'BYE') {
        Object.assign(data, { status: 'SCHEDULED', resultType: null, winnerSide: null });
      } else if (row.resultType === 'WALKOVER' && row.status !== 'OFFICIAL') {
        Object.assign(data, { resultType: null, winnerSide: null });
      }
    }

    if (!Object.keys(data).length) continue;
    await tx.match.update({ where: { id: row.id }, data });
    filled.push(row.id);
    updated++;
  }
  // A pending walkover completes as soon as the opponent is filled in.
  if (mode === 'fill') for (const id of filled) await settleDeferredWalkover(tx, id);

  const withdrawnIds = mode === 'fill' ? await withdrawnAmong(tx, [...filledEntries]) : carried;
  for (const entryId of withdrawnIds) {
    const impacts = await markWalkoverForEntry(tx, drawId, entryId, mode === 'fill');
    updated += impacts.length;
  }
  return updated;
}

type ExistingRow = { side1EntryId: string | null; side2EntryId: string | null; status: string; resultType: string | null; winnerSide: number | null };

function pendingWalkoverLosers(rows: readonly ExistingRow[]): string[] {
  const losers = rows
    .filter((r) => r.resultType === 'WALKOVER' && r.status !== 'OFFICIAL' && (r.winnerSide === 1 || r.winnerSide === 2))
    .map((r) => (r.winnerSide === 1 ? r.side2EntryId : r.side1EntryId));
  return [...new Set(losers.filter((id): id is string => Boolean(id)))];
}

async function withdrawnAmong(tx: Tx, entryIds: string[]): Promise<string[]> {
  if (!entryIds.length) return [];
  const rows = await tx.entry.findMany({ where: { id: { in: entryIds }, status: 'WITHDRAWN' }, select: { id: true } });
  return rows.map((r) => r.id);
}

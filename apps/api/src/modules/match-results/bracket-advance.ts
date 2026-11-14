import { Prisma } from '@kamito/db';
import { conflict } from '../draws/draw-errors.js';
import { markWalkoverForEntry, settleDeferredWalkover } from '../draws/knockout-walkover.js';

type Tx = Prisma.TransactionClient;

export interface AdvanceOutcome {
  /** The next match plus every later match a settled walkover pushed the winner into. */
  matchNos: number[];
  /** Everyone sitting in those matches, including the withdrawn loser of a settled walkover. */
  entryIds: string[];
}

/**
 * Puts the winner of a just-confirmed match into its next match, then settles a pending walkover waiting
 * there (which may cascade further). BYEs never reach this point: they only exist in the first round and
 * are resolved when the draw is derived. Returns what changed, for cache invalidation.
 */
export async function advanceWinner(tx: Tx, match: { nextMatchId: string | null; nextMatchSide: number | null }, winnerEntryId: string): Promise<AdvanceOutcome> {
  if (!match.nextMatchId) return { matchNos: [], entryIds: [] };
  const next = await tx.match.findUniqueOrThrow({ where: { id: match.nextMatchId } });
  const slot = match.nextMatchSide === 1 ? 'side1' : 'side2';
  const occupant = next[`${slot}EntryId`];
  if (occupant && occupant !== winnerEntryId) throw conflict('ADVANCEMENT_CONFLICT', `Trận #${next.matchNo} đã có VĐV khác ở vị trí này`);
  if (!occupant) {
    await tx.match.update({
      where: { id: next.id },
      data: { [`${slot}EntryId`]: winnerEntryId, [`${slot}Source`]: Prisma.DbNull, version: { increment: 1 } },
    });
  }
  // A winner who withdrew earlier (a reopened match re-confirmed) loses its next match by walkover again.
  const winner = await tx.entry.findUniqueOrThrow({ where: { id: winnerEntryId }, select: { status: true } });
  if (winner.status === 'WITHDRAWN') await markWalkoverForEntry(tx, next.drawId, winnerEntryId);
  await settleDeferredWalkover(tx, next.id);
  return collectChain(tx, next.id);
}

async function collectChain(tx: Tx, fromId: string): Promise<AdvanceOutcome> {
  const outcome: AdvanceOutcome = { matchNos: [], entryIds: [] };
  let currentId: string | null = fromId;
  while (currentId) {
    const row: { matchNo: number; status: string; nextMatchId: string | null; side1EntryId: string | null; side2EntryId: string | null } = await tx.match.findUniqueOrThrow({
      where: { id: currentId },
      select: { matchNo: true, status: true, nextMatchId: true, side1EntryId: true, side2EntryId: true },
    });
    outcome.matchNos.push(row.matchNo);
    for (const id of [row.side1EntryId, row.side2EntryId]) if (id) outcome.entryIds.push(id);
    currentId = row.status === 'OFFICIAL' ? row.nextMatchId : null;
  }
  return outcome;
}

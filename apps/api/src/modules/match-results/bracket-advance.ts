import { Prisma } from '@kamito/db';
import { conflict } from '../draws/draw-errors.js';
import { settleDeferredWalkover } from '../draws/knockout-walkover.js';

type Tx = Prisma.TransactionClient;

/**
 * Puts the winner of a just-confirmed match into its next match, then settles a pending walkover waiting
 * there (which may cascade further). BYEs never reach this point: they only exist in the first round and
 * are resolved when the draw is derived. Returns the match numbers that changed, for cache invalidation.
 */
export async function advanceWinner(tx: Tx, match: { nextMatchId: string | null; nextMatchSide: number | null }, winnerEntryId: string): Promise<number[]> {
  if (!match.nextMatchId) return [];
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
  await settleDeferredWalkover(tx, next.id);
  return collectChain(tx, next.id);
}

/** The next match plus every later match a settled walkover pushed the winner into. */
async function collectChain(tx: Tx, fromId: string): Promise<number[]> {
  const numbers: number[] = [];
  let currentId: string | null = fromId;
  while (currentId) {
    const row: { matchNo: number; status: string; nextMatchId: string | null } = await tx.match.findUniqueOrThrow({
      where: { id: currentId },
      select: { matchNo: true, status: true, nextMatchId: true },
    });
    numbers.push(row.matchNo);
    currentId = row.status === 'OFFICIAL' ? row.nextMatchId : null;
  }
  return numbers;
}

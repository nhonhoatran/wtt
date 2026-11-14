import { Prisma, type Draw } from '@kamito/db';
import { conflict, invalid } from './draw-errors.js';
import type { RawImpact } from './draw-impact.js';

type Tx = Prisma.TransactionClient;
type MatchRow = Prisma.MatchGetPayload<object>;

/**
 * Deferred walkover (contract for phase 07 result confirmation):
 * a match with `resultType = WALKOVER`, `status = SCHEDULED` and `winnerSide` pointing at a side that is
 * still empty is a PENDING walkover. The withdrawn entry stays on its side, the winner is whoever is
 * advanced into the empty side. `settleDeferredWalkover` must be called after any code puts an entry into
 * a match side (syncDerivedMatches 'fill' does it; phase 07 advancement must too). It completes the match
 * (OFFICIAL, officialAt) and advances the winner, cascading while the next match is also pending.
 * Pending walkovers do not count as played (not OFFICIAL) and must not accept a result entry.
 */
export async function settleDeferredWalkover(tx: Tx, matchId: string): Promise<void> {
  let currentId: string | null = matchId;
  while (currentId) {
    const match: MatchRow | null = await tx.match.findUnique({ where: { id: currentId } });
    if (!match || match.resultType !== 'WALKOVER' || match.status !== 'SCHEDULED' || (match.winnerSide !== 1 && match.winnerSide !== 2)) return;
    const winnerId = match.winnerSide === 1 ? match.side1EntryId : match.side2EntryId;
    if (!winnerId) return;
    await tx.match.update({ where: { id: match.id }, data: { status: 'OFFICIAL', officialAt: new Date(), version: { increment: 1 } } });
    if (!match.nextMatchId) return;

    const next: MatchRow = await tx.match.findUniqueOrThrow({ where: { id: match.nextMatchId } });
    const slot = match.nextMatchSide === 1 ? 'side1' : 'side2';
    const occupant = next[`${slot}EntryId`];
    if (occupant && occupant !== winnerId) throw conflict('ADVANCEMENT_CONFLICT', 'Trận kế tiếp đã có VĐV khác ở vị trí này');
    if (!occupant) {
      await tx.match.update({ where: { id: next.id }, data: { [`${slot}EntryId`]: winnerId, [`${slot}Source`]: Prisma.DbNull, version: { increment: 1 } } });
    }
    currentId = next.id;
  }
}

/**
 * Marks the earliest unfinished match of `entryId` as a walkover for the opponent (now or on arrival).
 * No-op (empty result) when the entry has no unfinished match or the match is already marked.
 * `settle: false` only writes the marker; used while a draft is rebuilt and settled again at publish.
 */
export async function markWalkoverForEntry(tx: Tx, drawId: string, entryId: string, settle = true): Promise<RawImpact[]> {
  const matches = await tx.match.findMany({
    where: { drawId, OR: [{ side1EntryId: entryId }, { side2EntryId: entryId }] },
    include: { round: { select: { code: true, number: true } } },
    orderBy: { round: { number: 'asc' } },
  });
  const current = matches.find((m) => m.status !== 'OFFICIAL');
  if (!current || current.resultType === 'WALKOVER') return [];
  if (current.status === 'LIVE') throw conflict('MATCH_IN_PROGRESS', `Trận #${current.matchNo} đang diễn ra, hãy kết thúc trận trước khi rút VĐV`);

  const ownSide = current.side1EntryId === entryId ? 1 : 2;
  const winnerSide = ownSide === 1 ? 2 : 1;
  const opponentId = ownSide === 1 ? current.side2EntryId : current.side1EntryId;
  await tx.match.update({
    where: { id: current.id },
    data: { resultType: 'WALKOVER', winnerSide, version: { increment: 1 } },
  });
  if (settle) await settleDeferredWalkover(tx, current.id);
  return [
    {
      type: 'WALKOVER',
      matchId: current.id,
      matchNo: current.matchNo,
      roundCode: current.round.code,
      removedId: entryId,
      ...(opponentId && { beneficiaryId: opponentId }),
    },
  ];
}

/** Entry leaves a knockout draw: its current match becomes a walkover for the opponent. */
export async function withdrawFromKnockout(tx: Tx, draw: Draw, entryId: string): Promise<RawImpact[]> {
  const inDraw = await tx.bracketPosition.count({ where: { drawId: draw.id, entryId } });
  if (!inDraw) throw invalid('ENTRY_NOT_IN_DRAW', 'VĐV không nằm trong nhánh này');
  return markWalkoverForEntry(tx, draw.id, entryId);
}

/** Settles every pending walkover of a draw (publish), earliest round first. */
export async function settlePendingWalkovers(tx: Tx, drawId: string): Promise<void> {
  const pending = await tx.match.findMany({
    where: { drawId, resultType: 'WALKOVER', status: 'SCHEDULED' },
    select: { id: true },
    orderBy: { round: { number: 'asc' } },
  });
  for (const { id } of pending) await settleDeferredWalkover(tx, id);
}

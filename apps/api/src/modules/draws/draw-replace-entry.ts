import { locksDrawStructure } from '@kamito/shared';
import type { Draw, Prisma } from '@kamito/db';
import { conflict, invalid } from './draw-errors.js';
import type { RawImpact } from './draw-impact.js';

type Tx = Prisma.TransactionClient;

/**
 * Swaps the entry that sits at one position of a published knockout draw. Every match the old entry
 * appears in (round 1, plus the next match when a BYE advanced it) is rewritten; none may be started.
 */
export async function replaceEntryAtPosition(tx: Tx, draw: Draw, positionId: string, newEntryId: string): Promise<RawImpact[]> {
  const position = await tx.bracketPosition.findFirst({ where: { id: positionId, drawId: draw.id } });
  if (!position) throw invalid('POSITION_NOT_FOUND', 'Vị trí không thuộc nhánh này');
  if (position.source !== 'ENTRY' || !position.entryId) throw invalid('POSITION_NOT_REPLACEABLE', 'Vị trí này chưa có VĐV (BYE hoặc đang chờ xếp)');
  const oldEntryId = position.entryId;
  if (oldEntryId === newEntryId) throw invalid('ENTRY_NOT_ELIGIBLE', 'VĐV mới trùng với VĐV hiện tại');

  const [oldEntry, newEntry, alreadyInDraw] = await Promise.all([
    tx.entry.findUniqueOrThrow({ where: { id: oldEntryId }, select: { status: true } }),
    tx.entry.findUnique({ where: { id: newEntryId }, select: { status: true, subEventId: true, stage: true } }),
    tx.bracketPosition.count({ where: { drawId: draw.id, entryId: newEntryId } }),
  ]);
  if (oldEntry.status === 'WITHDRAWN') throw conflict('POSITION_ENTRY_WITHDRAWN', 'VĐV tại vị trí này đã rút, trận của họ được xử lý theo walkover');
  const stage = draw.kind === 'QUALIFYING' ? 'QUALIFYING' : 'MAIN';
  if (!newEntry || newEntry.subEventId !== draw.subEventId || newEntry.status !== 'CONFIRMED' || newEntry.stage !== stage || alreadyInDraw) {
    throw invalid('ENTRY_NOT_ELIGIBLE', 'VĐV mới phải đã xác nhận, cùng nội dung và chưa nằm trong nhánh này');
  }

  const matches = await tx.match.findMany({
    where: { drawId: draw.id, OR: [{ side1EntryId: oldEntryId }, { side2EntryId: oldEntryId }] },
    include: { round: { select: { code: true } } },
    orderBy: { round: { number: 'asc' } },
  });
  const played = matches.find((m) => locksDrawStructure(m));
  if (played) throw conflict('POSITION_ALREADY_PLAYED', `Trận #${played.matchNo} của vị trí này đã bắt đầu, không thể thay VĐV`);

  await tx.bracketPosition.update({ where: { id: position.id }, data: { entryId: newEntryId } });
  const impacts: RawImpact[] = [];
  for (const match of matches) {
    const data: Prisma.MatchUncheckedUpdateInput = { version: { increment: 1 } };
    if (match.side1EntryId === oldEntryId) data.side1EntryId = newEntryId;
    if (match.side2EntryId === oldEntryId) data.side2EntryId = newEntryId;
    await tx.match.update({ where: { id: match.id }, data });
    impacts.push({ type: 'REPLACE_SIDE', matchId: match.id, matchNo: match.matchNo, roundCode: match.round.code, removedId: oldEntryId, addedId: newEntryId });
  }
  return impacts;
}

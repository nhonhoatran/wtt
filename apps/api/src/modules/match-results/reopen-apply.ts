import type { ImpactCell, ImpactMatch } from '@kamito/competition-engine';
import { Prisma } from '@kamito/db';

type Tx = Prisma.TransactionClient;

export interface ResetMatch {
  matchId: string;
  matchNo: number;
  /** Result that was wiped by a forced reopen; kept in the audit row. */
  before: { status: string; resultType: string | null; winnerSide: number | null; games1: number | null; games2: number | null; games: { number: number; score1: number; score2: number }[] };
}

const RESET_DATA = {
  status: 'SCHEDULED',
  resultType: null,
  winnerSide: null,
  games1: null,
  games2: null,
  startedAt: null,
  officialAt: null,
  officialById: null,
} as const;

/**
 * Takes the entries out of the sides and bracket slots listed by the impact walk. A cleared side goes back
 * to what it waited for: the feeding match, or the qualifier / group place of the slot.
 * Played matches (blocking cells) are wiped too, so call this only for a forced reopen or an empty `blocking`.
 */
export async function applyReopenCells(tx: Tx, cells: readonly ImpactCell[], matches: ReadonlyMap<string, ImpactMatch>): Promise<ResetMatch[]> {
  const restored = new Map<string, Prisma.InputJsonObject | null>();
  const resets: ResetMatch[] = [];
  for (const cell of cells) {
    const target = matches.get(cell.matchId) as ImpactMatch;
    const source = sourceAfterClear(cell, matches, restored);
    restored.set(`${cell.matchId}:${cell.side}`, source);
    const data: Prisma.MatchUncheckedUpdateInput = {
      [`side${cell.side}EntryId`]: null,
      [`side${cell.side}Source`]: source ?? Prisma.DbNull,
      version: { increment: 1 },
    };
    if (cell.effect === 'RESET_RESULT') {
      if (!resets.some((r) => r.matchId === cell.matchId)) {
        const games = await tx.game.findMany({ where: { matchId: cell.matchId }, orderBy: { number: 'asc' }, select: { number: true, score1: true, score2: true } });
        const old = await tx.match.findUniqueOrThrow({ where: { id: cell.matchId }, select: { games1: true, games2: true } });
        resets.push({ matchId: cell.matchId, matchNo: cell.matchNo, before: { status: target.status, resultType: target.resultType, winnerSide: target.winnerSide, ...old, games } });
      }
      await tx.game.deleteMany({ where: { matchId: cell.matchId } });
      Object.assign(data, RESET_DATA);
    } else if (cell.walkoverLoser) {
      Object.assign(data, { status: 'SCHEDULED', resultType: null, winnerSide: null, officialAt: null });
    } else if (cell.effect === 'REVERT_AUTO' && target.resultType === 'WALKOVER') {
      Object.assign(data, { status: 'SCHEDULED', officialAt: null });
    }
    await tx.match.update({ where: { id: cell.matchId }, data });
    if (cell.seat) {
      const { positionId, ref } = cell.seat;
      await tx.bracketPosition.update({ where: { id: positionId }, data: { source: ref.type, entryId: null, sourceRef: { ...ref } } });
    }
  }
  return resets;
}

function sourceAfterClear(cell: ImpactCell, matches: ReadonlyMap<string, ImpactMatch>, restored: ReadonlyMap<string, Prisma.InputJsonObject | null>): Prisma.InputJsonObject | null {
  if (cell.seat) return { ...cell.seat.ref };
  const feeder = cell.fromMatchId ? matches.get(cell.fromMatchId) : undefined;
  if (!feeder) return null;
  // A BYE first-round match passes its slot placeholder on instead of being referenced as a feeder.
  if (feeder.resultType === 'BYE') return restored.get(`${feeder.id}:${feeder.winnerSide}`) ?? null;
  return { type: 'WINNER_OF', matchNo: feeder.matchNo };
}

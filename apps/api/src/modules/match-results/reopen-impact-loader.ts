import { computeReopenImpact, type ImpactMatch, type ImpactSeat, type ReopenImpact } from '@kamito/competition-engine';
import type { Prisma } from '@kamito/db';
import type { MatchDetailRow } from '../matches/match-result-view.js';

type Tx = Prisma.TransactionClient;

export interface LoadedImpact {
  impact: ReopenImpact;
  matches: Map<string, ImpactMatch>;
}

const MATCH_SELECT = {
  id: true,
  matchNo: true,
  status: true,
  resultType: true,
  winnerSide: true,
  officialById: true,
  side1EntryId: true,
  side2EntryId: true,
  nextMatchId: true,
  nextMatchSide: true,
  drawId: true,
  section: true,
  orderInRound: true,
  round: { select: { number: true } },
} satisfies Prisma.MatchSelect;

type Row = Prisma.MatchGetPayload<{ select: typeof MATCH_SELECT }>;

const winnerEntryOf = (m: Row) => (m.status !== 'OFFICIAL' ? null : m.winnerSide === 1 ? m.side1EntryId : m.winnerSide === 2 ? m.side2EntryId : null);

/**
 * Reads everything the impact walk needs from the sub-event of `root`: its matches and the slots of the
 * main draw already filled from the qualifying or group draw. Call it under the locks of the reopen.
 */
export async function loadReopenImpact(tx: Tx, root: MatchDetailRow): Promise<LoadedImpact> {
  const rows = await tx.match.findMany({ where: { subEventId: root.subEventId }, select: MATCH_SELECT });
  const seats = await loadSeats(tx, root, rows);
  const matches = new Map<string, ImpactMatch>(rows.map((r) => [r.id, r]));
  const impact = computeReopenImpact({ rootId: root.id, matches: rows, seats, rootIsGroupMatch: root.groupId !== null });
  return { impact, matches };
}

async function loadSeats(tx: Tx, root: MatchDetailRow, rows: Row[]): Promise<ImpactSeat[]> {
  if (root.draw.kind === 'MAIN') return [];
  const main = await tx.draw.findUnique({ where: { subEventId_kind: { subEventId: root.subEventId, kind: 'MAIN' } }, select: { id: true } });
  if (!main) return [];

  const refByEntry = new Map<string, ImpactSeat['ref']>();
  if (root.draw.kind === 'QUALIFYING') {
    for (const final of rows.filter((r) => r.drawId === root.drawId && r.nextMatchId === null)) {
      const winner = winnerEntryOf(final);
      if (winner) refByEntry.set(winner, { type: 'QUALIFIER', index: final.section });
    }
  } else if (root.groupId) {
    const group = await tx.group.findUniqueOrThrow({ where: { id: root.groupId }, select: { code: true, standings: { select: { entryId: true, rank: true } } } });
    for (const s of group.standings) if (s.rank !== null) refByEntry.set(s.entryId, { type: 'GROUP_PLACE', group: group.code, place: s.rank });
  }
  if (!refByEntry.size) return [];

  const positions = await tx.bracketPosition.findMany({ where: { drawId: main.id, entryId: { in: [...refByEntry.keys()] } } });
  const seats: ImpactSeat[] = [];
  for (const p of positions) {
    const first = rows.find((r) => r.drawId === main.id && r.section === p.section && r.round.number === 1 && r.orderInRound === Math.ceil(p.position / 2));
    const kept = p.sourceRef as ImpactSeat['ref'] | null;
    const ref = kept && kept.type === refByEntry.get(p.entryId as string)?.type ? kept : refByEntry.get(p.entryId as string);
    if (first && ref) seats.push({ entryId: p.entryId as string, matchId: first.id, side: p.position % 2 === 1 ? 1 : 2, positionId: p.id, ref });
  }
  return seats;
}

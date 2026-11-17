import type { PrismaClient } from '@kamito/db';
import type { IsoDate, LedgerRowInput } from '@kamito/ranking-engine';
import { fromIsoDate, toIsoDate } from './ranking-dates.js';

export interface SnapshotLedger {
  rows: LedgerRowInput[];
  playerNames: Map<string, string>;
}

/** Ledger rows valid on `asOf` with the event fields the breakdown copies. */
export async function loadSnapshotLedger(prisma: PrismaClient, listId: string, asOf: IsoDate): Promise<SnapshotLedger> {
  const asOfDate = fromIsoDate(asOf);
  const ledger = await prisma.rankingPointsEarned.findMany({
    where: { rankingListId: listId, earnedAt: { lte: asOfDate }, expiresAt: { gt: asOfDate } },
    select: {
      id: true,
      playerId: true,
      eventId: true,
      points: true,
      stageCode: true,
      earnedAt: true,
      expiresAt: true,
      event: { select: { slug: true, name: true, nameEn: true, eventType: { select: { code: true } } } },
    },
  });
  const rows: LedgerRowInput[] = ledger.map((row) => ({
    id: row.id,
    playerId: row.playerId,
    eventId: row.eventId,
    points: row.points,
    stageCode: row.stageCode,
    earnedAt: toIsoDate(row.earnedAt),
    expiresAt: toIsoDate(row.expiresAt),
    eventSlug: row.event?.slug ?? null,
    eventName: row.event?.name ?? null,
    eventNameEn: row.event?.nameEn ?? null,
    eventTypeCode: row.event?.eventType.code ?? null,
  }));

  const playerIds = [...new Set(rows.map((row) => row.playerId))];
  const players = playerIds.length
    ? await prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, fullName: true } })
    : [];
  return { rows, playerNames: new Map(players.map((player) => [player.id, player.fullName])) };
}

/** playerId -> rank in the latest PUBLISHED snapshot of the list. */
export async function loadPreviousRanks(prisma: PrismaClient, listId: string): Promise<Map<string, number>> {
  const latest = await prisma.rankingSnapshot.findFirst({
    where: { rankingListId: listId, status: 'PUBLISHED' },
    orderBy: [{ asOfDate: 'desc' }, { publishedAt: 'desc' }],
    select: { id: true },
  });
  if (!latest) return new Map();
  const rows = await prisma.rankingSnapshotRow.findMany({ where: { snapshotId: latest.id }, select: { playerId: true, rank: true } });
  return new Map(rows.map((row) => [row.playerId, row.rank]));
}

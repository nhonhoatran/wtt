import type { Prisma } from '@kamito/db';
import type { CompetitorKind, EngineGroupStanding, EngineMatch, IsoDate } from '@kamito/ranking-engine';
import { toIsoDate } from './ranking-dates.js';

type Tx = Prisma.TransactionClient;

export interface SubEventRankingInput {
  subEventId: string;
  eventId: string;
  eventTypeId: string;
  endDate: IsoDate;
  isCancelled: boolean;
  competitorKind: CompetitorKind;
  list: { id: string; validityDays: number; groupStageByRank: boolean } | null;
  entries: { id: string; playerIds: string[] }[];
  matchesByEntry: Map<string, EngineMatch[]>;
  standingByEntry: Map<string, EngineGroupStanding>;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** Reads everything the engine needs for one sub-event; null when the sub-event no longer exists. */
export async function loadSubEventRankingInput(tx: Tx, subEventId: string): Promise<SubEventRankingInput | null> {
  const subEvent = await tx.subEvent.findUnique({
    where: { id: subEventId },
    select: {
      discipline: { select: { competitorKind: true } },
      rankingList: { select: { id: true, validityDays: true, groupStageByRank: true } },
      event: { select: { id: true, eventTypeId: true, endDate: true, isCancelled: true } },
    },
  });
  if (!subEvent) return null;

  const [entryRows, matchRows, standingRows] = await Promise.all([
    tx.entry.findMany({
      where: { subEventId, status: 'CONFIRMED' },
      select: { id: true, competitor: { select: { playerId: true, pair: { select: { playerAId: true, playerBId: true } } } } },
    }),
    tx.match.findMany({
      where: { subEventId },
      select: {
        groupId: true,
        section: true,
        status: true,
        resultType: true,
        winnerSide: true,
        isVoided: true,
        side1EntryId: true,
        side2EntryId: true,
        draw: { select: { kind: true } },
        round: { select: { code: true, number: true } },
      },
    }),
    tx.groupStanding.findMany({
      where: { group: { draw: { subEventId } } },
      select: { groupId: true, entryId: true, rank: true, qualified: true },
    }),
  ]);

  const unfinishedGroups = new Set<string>();
  const matchesByEntry = new Map<string, EngineMatch[]>();
  for (const row of matchRows) {
    if (row.groupId && !row.isVoided && row.status !== 'OFFICIAL') unfinishedGroups.add(row.groupId);
    const match: EngineMatch = {
      drawKind: row.draw.kind,
      section: row.section,
      roundCode: row.round.code,
      roundNumber: row.round.number,
      status: row.status,
      resultType: row.resultType,
      winnerSide: row.winnerSide,
      isVoided: row.isVoided,
      side1EntryId: row.side1EntryId,
      side2EntryId: row.side2EntryId,
    };
    if (row.side1EntryId) push(matchesByEntry, row.side1EntryId, match);
    if (row.side2EntryId) push(matchesByEntry, row.side2EntryId, match);
  }

  const standingByEntry = new Map<string, EngineGroupStanding>();
  for (const row of standingRows) {
    standingByEntry.set(row.entryId, {
      entryId: row.entryId,
      rank: row.rank,
      qualified: row.qualified,
      complete: !unfinishedGroups.has(row.groupId),
    });
  }

  return {
    subEventId,
    eventId: subEvent.event.id,
    eventTypeId: subEvent.event.eventTypeId,
    endDate: toIsoDate(subEvent.event.endDate),
    isCancelled: subEvent.event.isCancelled,
    competitorKind: subEvent.discipline.competitorKind,
    list: subEvent.rankingList,
    entries: entryRows.map((entry) => ({ id: entry.id, playerIds: playerIdsOf(entry.competitor) })),
    matchesByEntry,
    standingByEntry,
  };
}

function playerIdsOf(competitor: { playerId: string | null; pair: { playerAId: string; playerBId: string } | null }): string[] {
  if (competitor.pair) return [competitor.pair.playerAId, competitor.pair.playerBId];
  return competitor.playerId ? [competitor.playerId] : [];
}

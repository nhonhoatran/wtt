import type { PrismaClient } from '@kamito/db';
import { playerSettings, type EntryImportRawRow } from '@kamito/shared';
import type { SubEventInfo } from './entry-row-mapper.js';
import { readSetting } from './import-deps.js';
import { loadPlayerIndex } from './player-lookup.js';
import { competitorKey, type EvaluationContext } from './row-evaluator.js';

export async function loadSubEventInfos(prisma: Pick<PrismaClient, 'subEvent'>, eventId: string): Promise<Map<string, SubEventInfo>> {
  const rows = await prisma.subEvent.findMany({
    where: { eventId },
    select: {
      id: true,
      code: true,
      hasQualifying: true,
      maxEntries: true,
      discipline: { select: { competitorKind: true, genderRule: true } },
      category: { select: { name: true, minAge: true, maxAge: true } },
    },
  });
  return new Map(
    rows.map((row) => [
      row.code.toUpperCase(),
      {
        id: row.id,
        code: row.code,
        competitorKind: row.discipline.competitorKind,
        genderRule: row.discipline.genderRule,
        hasQualifying: row.hasQualifying,
        maxEntries: row.maxEntries,
        category: row.category,
      } satisfies SubEventInfo,
    ]),
  );
}

export async function loadEvaluationContext(
  prisma: PrismaClient,
  eventId: string,
  rows: EntryImportRawRow[],
  currentYear: number,
): Promise<EvaluationContext> {
  const [event, subEvents, ageMethod] = await Promise.all([
    prisma.event.findUniqueOrThrow({ where: { id: eventId }, select: { startDate: true } }),
    loadSubEventInfos(prisma, eventId),
    readSetting(prisma, playerSettings.ageCalculation),
  ]);
  const wanted = rows.flatMap((row) => [
    { code: row.player1Code || null, fullName: row.player1Name ?? '' },
    { code: row.player2Code || null, fullName: row.player2Name ?? '' },
  ]);
  const index = await loadPlayerIndex(prisma, wanted);

  const entries = await prisma.entry.findMany({
    where: { subEventId: { in: [...subEvents.values()].map((subEvent) => subEvent.id) }, status: 'CONFIRMED' },
    select: { id: true, subEventId: true, stage: true, seed: true, competitor: { select: { playerId: true, pair: { select: { playerAId: true, playerBId: true } } } } },
  });
  const existingEntries = new Map<string, { id: string }>();
  const enteredPlayers = new Set<string>();
  const existingSeeds = new Map<string, string>();
  for (const entry of entries) {
    const ids = entry.competitor.playerId ? [entry.competitor.playerId] : [entry.competitor.pair!.playerAId, entry.competitor.pair!.playerBId];
    existingEntries.set(competitorKey(entry.subEventId, ids), { id: entry.id });
    ids.forEach((id) => enteredPlayers.add(`${entry.subEventId}|${id}`));
    if (entry.seed !== null) existingSeeds.set(`${entry.subEventId}|${entry.stage}|${entry.seed}`, entry.id);
  }
  return { subEvents, index, ageMethod, eventStartDate: event.startDate, currentYear, existingEntries, enteredPlayers, existingSeeds };
}

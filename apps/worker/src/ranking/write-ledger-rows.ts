import type { Prisma } from '@kamito/db';
import { pointsForEntry, stageReached, type LedgerDraft, type PointsRule, type StageOptions } from '@kamito/ranking-engine';
import type { SubEventRankingInput } from './load-sub-event-results.js';
import { fromIsoDate, toIsoDate } from './ranking-dates.js';

type Tx = Prisma.TransactionClient;

export async function loadRules(tx: Tx, input: SubEventRankingInput): Promise<PointsRule[]> {
  const rows = await tx.rankingPointsRule.findMany({ where: { eventTypeId: input.eventTypeId, competitorKind: input.competitorKind } });
  return rows.map((row) => ({
    eventTypeId: row.eventTypeId,
    competitorKind: row.competitorKind,
    drawKind: row.drawKind,
    stageCode: row.stageCode,
    points: row.points,
    effectiveFrom: toIsoDate(row.effectiveFrom),
  }));
}

/** Cancelled events and sub-events without a ranking list earn nothing. */
export function computeLedgerDrafts(
  input: SubEventRankingInput,
  rules: PointsRule[],
  options: Pick<StageOptions, 'awardPointsOnWalkoverLoss'>,
): LedgerDraft[] {
  const { list } = input;
  if (!list || input.isCancelled) return [];
  const stageOptions: StageOptions = { ...options, groupStageByRank: list.groupStageByRank };
  return input.entries.flatMap((entry) => {
    const matches = input.matchesByEntry.get(entry.id) ?? [];
    const stage = stageReached(entry.id, matches, input.standingByEntry.get(entry.id) ?? null, stageOptions);
    return pointsForEntry({
      entryId: entry.id,
      playerIds: entry.playerIds,
      stage,
      rules,
      eventTypeId: input.eventTypeId,
      competitorKind: input.competitorKind,
      endDate: input.endDate,
      validityDays: list.validityDays,
    });
  });
}

/** Rebuilds all AUTO rows of the sub-event; MANUAL rows are never touched. */
export async function replaceAutoLedgerRows(tx: Tx, input: SubEventRankingInput, drafts: LedgerDraft[]): Promise<void> {
  await tx.rankingPointsEarned.deleteMany({ where: { subEventId: input.subEventId, source: 'AUTO' } });
  if (!input.list || !drafts.length) return;
  const rankingListId = input.list.id;
  await tx.rankingPointsEarned.createMany({
    data: drafts.map((draft) => ({
      rankingListId,
      playerId: draft.playerId,
      source: 'AUTO' as const,
      subEventId: input.subEventId,
      eventId: input.eventId,
      entryId: draft.entryId,
      stageCode: draft.stageCode,
      points: draft.points,
      ruleEffectiveFrom: fromIsoDate(draft.ruleEffectiveFrom),
      earnedAt: fromIsoDate(draft.earnedAt),
      expiresAt: fromIsoDate(draft.expiresAt),
    })),
  });
}

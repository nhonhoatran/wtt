import { addDays } from './date-math.js';
import { ruleFor } from './rule-for-date.js';
import type { CompetitorKind, IsoDate, LedgerDraft, PointsRule, StageReached } from './types.js';

export interface PointsForEntryInput {
  entryId: string;
  playerIds: string[];
  stage: StageReached | null;
  rules: PointsRule[];
  eventTypeId: string;
  competitorKind: CompetitorKind;
  endDate: IsoDate;
  validityDays: number;
}

/** One ledger draft per player of the entry; zero or missing rules yield nothing. */
export function pointsForEntry(input: PointsForEntryInput): LedgerDraft[] {
  const { stage } = input;
  if (!stage) return [];
  const rule = ruleFor(input.rules, {
    eventTypeId: input.eventTypeId,
    competitorKind: input.competitorKind,
    drawKind: stage.drawKind,
    stageCode: stage.stageCode,
    endDate: input.endDate,
  });
  if (!rule || rule.points === 0) return [];
  const expiresAt = addDays(input.endDate, input.validityDays);
  return input.playerIds.map((playerId) => ({
    playerId,
    entryId: input.entryId,
    stageCode: stage.stageCode,
    points: rule.points,
    ruleEffectiveFrom: rule.effectiveFrom,
    earnedAt: input.endDate,
    expiresAt,
  }));
}

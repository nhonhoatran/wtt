import type { CompetitorKind, DrawKind, IsoDate, PointsRule } from './types.js';

export interface RuleQuery {
  eventTypeId: string;
  competitorKind: CompetitorKind;
  drawKind: DrawKind;
  stageCode: string;
  endDate: IsoDate;
}

/** Each cell versions independently: the newest effectiveFrom not after the event end date wins. */
export function ruleFor(rules: PointsRule[], query: RuleQuery): PointsRule | null {
  let best: PointsRule | null = null;
  for (const rule of rules) {
    if (
      rule.eventTypeId !== query.eventTypeId ||
      rule.competitorKind !== query.competitorKind ||
      rule.drawKind !== query.drawKind ||
      rule.stageCode !== query.stageCode ||
      rule.effectiveFrom > query.endDate
    ) {
      continue;
    }
    if (!best || rule.effectiveFrom > best.effectiveFrom) best = rule;
  }
  return best;
}

import type { DrawKind } from '../event-hub/draw-types';

export type CompetitorKind = 'SINGLES' | 'DOUBLES';

export interface RuleEventType {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  tier: { id: string; name: string } | null;
}

export interface RuleCellEdit {
  eventTypeId: string;
  stageCode: string;
  points: number;
}

export interface RulesMatrix {
  competitorKind: CompetitorKind;
  drawKind: DrawKind;
  asOf: string;
  eventTypes: RuleEventType[];
  stageCodes: string[];
  cells: (RuleCellEdit & { effectiveFrom: string })[];
  versions: string[];
}

export type RuleEdits = Record<string, RuleCellEdit>;

export interface ScopedRuleEdits {
  scope: string;
  edits: RuleEdits;
}

type OriginalPoints = ReadonlyMap<string, number>;

export const cellKey = (eventTypeId: string, stageCode: string) => `${eventTypeId}|${stageCode}`;

/** Unsaved values only belong to the singles/doubles, draw and version that supplied their baseline. */
export const editsInScope = (state: ScopedRuleEdits, scope: string): RuleEdits => state.scope === scope ? state.edits : {};

export function updateScopedRuleEdits(state: ScopedRuleEdits, scope: string, update: (edits: RuleEdits) => RuleEdits): ScopedRuleEdits {
  return { scope, edits: update(editsInScope(state, scope)) };
}

export const ruleCellValue = (edits: RuleEdits, original: OriginalPoints, eventTypeId: string, stageCode: string) =>
  edits[cellKey(eventTypeId, stageCode)]?.points ?? original.get(cellKey(eventTypeId, stageCode)) ?? null;

export const originalRuleValue = (original: OriginalPoints, eventTypeId: string, stageCode: string) =>
  original.get(cellKey(eventTypeId, stageCode)) ?? null;

export const isValidRulePoints = (points: number) => Number.isInteger(points) && points >= 0;

export const invalidRuleCells = (edits: RuleEdits): RuleCellEdit[] => Object.values(edits).filter((edit) => !isValidRulePoints(edit.points));

/** A cleared input restores the stored value; an explicit zero is still a rule. */
export function updateRuleCell(edits: RuleEdits, original: OriginalPoints, eventTypeId: string, stageCode: string, points: number | null): RuleEdits {
  const key = cellKey(eventTypeId, stageCode);
  const next = { ...edits };
  delete next[key];
  return points === null || points === original.get(key) ? next : { ...next, [key]: { eventTypeId, stageCode, points } };
}

/** Copy the visible source values, including unsaved edits; blank source cells leave the target alone. */
export function copyRuleColumn(edits: RuleEdits, original: OriginalPoints, stageCodes: readonly string[], fromId: string, toId: string): RuleEdits {
  return stageCodes.reduce((next, stageCode) => {
    const points = ruleCellValue(edits, original, fromId, stageCode);
    return points === null ? next : updateRuleCell(next, original, toId, stageCode, points);
  }, edits);
}

/** Saving a future version compares edits with the rules in force on that date, rather than today's matrix. */
export function changedRuleCells(edits: RuleCellEdit[], baseline: readonly RuleCellEdit[]): RuleCellEdit[] {
  const original = new Map(baseline.map((cell) => [cellKey(cell.eventTypeId, cell.stageCode), cell.points]));
  return edits.filter((edit) => original.get(cellKey(edit.eventTypeId, edit.stageCode)) !== edit.points);
}

/** Active event types, plus hidden ones that still hold rules in this matrix. */
export const visibleEventTypes = (matrix: RulesMatrix) =>
  matrix.eventTypes.filter((eventType) => eventType.isActive || matrix.cells.some((cell) => cell.eventTypeId === eventType.id));

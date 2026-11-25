import { keepPreviousData, useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { apiFetch } from '../../api/http-client';
import { DATE_ONLY_FORMAT } from '../../resources/events/event-labels';
import type { DrawKind } from '../event-hub/draw-types';
import { cellKey, copyRuleColumn, editsInScope, invalidRuleCells, isValidRulePoints, originalRuleValue, ruleCellValue, updateRuleCell, updateScopedRuleEdits, type CompetitorKind, type RuleEdits, type RulesMatrix, type ScopedRuleEdits } from './ranking-rules-state';

export { cellKey, visibleEventTypes } from './ranking-rules-state';
export type { CompetitorKind, RuleCellEdit, RuleEventType, RulesMatrix } from './ranking-rules-state';

const KINDS: CompetitorKind[] = ['SINGLES', 'DOUBLES'];
const DRAWS: DrawKind[] = ['MAIN', 'QUALIFYING', 'GROUP'];
export const RULES_KEY = 'admin-ranking-rules';

export function useRankingRulesMatrix() {
  const [params, setParams] = useSearchParams();
  const kind = KINDS.find((value) => value === params.get('kind')) ?? 'SINGLES';
  const draw = DRAWS.find((value) => value === params.get('draw')) ?? 'MAIN';
  const asOfParam = params.get('asOf') ?? '';
  const asOf = dayjs(asOfParam, DATE_ONLY_FORMAT, true).isValid() ? asOfParam : '';
  // No asOf asks for the rules in force today (the server decides what today is); that is the only editable view.
  const readOnly = asOf !== '';

  const query = useQuery({
    queryKey: [RULES_KEY, kind, draw, asOf],
    queryFn: async () => {
      const search = new URLSearchParams({ 'filter[competitorKind]': kind, 'filter[drawKind]': draw, ...(asOf && { 'filter[asOf]': asOf }) });
      return (await apiFetch<{ data: RulesMatrix }>(`/admin/ranking-rules?${search}`)).data;
    },
    placeholderData: keepPreviousData,
  });

  // Edits belong to the (kind, draw, version) they were made on and never leak into another.
  const scope = `${kind}|${draw}|${asOf}`;
  const [state, setState] = useState<ScopedRuleEdits>({ scope, edits: {} });
  const edits = useMemo(() => editsInScope(state, scope), [state, scope]);
  const setEdits = useCallback(
    (update: (current: RuleEdits) => RuleEdits) =>
      setState((previous) => updateScopedRuleEdits(previous, scope, update)),
    [scope],
  );
  useEffect(() => setState((previous) => (previous.scope === scope ? previous : { scope, edits: {} })), [scope]);

  const original = useMemo(() => new Map((query.data?.cells ?? []).map((cell) => [cellKey(cell.eventTypeId, cell.stageCode), cell.points])), [query.data]);
  const valueOf = useCallback((eventTypeId: string, stageCode: string) => ruleCellValue(edits, original, eventTypeId, stageCode), [edits, original]);

  const setCell = useCallback(
    (eventTypeId: string, stageCode: string, points: number | null) => {
      setEdits((current) => updateRuleCell(current, original, eventTypeId, stageCode, points));
    },
    [original, setEdits],
  );

  const copyColumn = useCallback(
    (fromId: string, toId: string) => {
      setEdits((current) => copyRuleColumn(current, original, query.data?.stageCodes ?? [], fromId, toId));
    },
    [query.data, original, setEdits],
  );

  const setParam = (key: string, value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'asOf') next.delete('asOf');
      return next;
    });

  return {
    kind,
    draw,
    asOf,
    readOnly,
    query,
    stale: query.isPlaceholderData,
    edits: Object.values(edits),
    invalidCount: invalidRuleCells(edits).length,
    isEdited: (eventTypeId: string, stageCode: string) => cellKey(eventTypeId, stageCode) in edits,
    isInvalid: (eventTypeId: string, stageCode: string) => {
      const edit = edits[cellKey(eventTypeId, stageCode)];
      return edit !== undefined && !isValidRulePoints(edit.points);
    },
    originalOf: (eventTypeId: string, stageCode: string) => originalRuleValue(original, eventTypeId, stageCode),
    valueOf,
    setCell,
    copyColumn,
    discard: () => setEdits(() => ({})),
    setKind: (value: CompetitorKind) => setParam('kind', value),
    setDraw: (value: DrawKind) => setParam('draw', value),
    setAsOf: (value: string) => setParam('asOf', value),
  };
}

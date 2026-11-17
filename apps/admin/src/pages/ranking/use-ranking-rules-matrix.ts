import { keepPreviousData, useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { apiFetch } from '../../api/http-client';
import { DATE_ONLY_FORMAT } from '../../resources/events/event-labels';
import type { DrawKind } from '../event-hub/draw-types';

export type CompetitorKind = 'SINGLES' | 'DOUBLES';

export interface RuleEventType {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  tier: { id: string; name: string } | null;
}

export interface RulesMatrix {
  competitorKind: CompetitorKind;
  drawKind: DrawKind;
  asOf: string;
  eventTypes: RuleEventType[];
  stageCodes: string[];
  cells: { eventTypeId: string; stageCode: string; points: number; effectiveFrom: string }[];
  versions: string[];
}

export interface RuleCellEdit {
  eventTypeId: string;
  stageCode: string;
  points: number;
}

const KINDS: CompetitorKind[] = ['SINGLES', 'DOUBLES'];
const DRAWS: DrawKind[] = ['MAIN', 'QUALIFYING', 'GROUP'];
export const RULES_KEY = 'admin-ranking-rules';
export const cellKey = (eventTypeId: string, stageCode: string) => `${eventTypeId}|${stageCode}`;

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
  const [state, setState] = useState<{ scope: string; edits: Record<string, RuleCellEdit> }>({ scope, edits: {} });
  const edits = useMemo(() => (state.scope === scope ? state.edits : {}), [state, scope]);
  const setEdits = useCallback(
    (update: (current: Record<string, RuleCellEdit>) => Record<string, RuleCellEdit>) =>
      setState((previous) => ({ scope, edits: update(previous.scope === scope ? previous.edits : {}) })),
    [scope],
  );
  useEffect(() => setState((previous) => (previous.scope === scope ? previous : { scope, edits: {} })), [scope]);

  const original = useMemo(() => new Map((query.data?.cells ?? []).map((cell) => [cellKey(cell.eventTypeId, cell.stageCode), cell.points])), [query.data]);
  const valueOf = useCallback((eventTypeId: string, stageCode: string) => edits[cellKey(eventTypeId, stageCode)]?.points ?? original.get(cellKey(eventTypeId, stageCode)) ?? null, [edits, original]);

  const setCell = useCallback(
    (eventTypeId: string, stageCode: string, points: number | null) => {
      const key = cellKey(eventTypeId, stageCode);
      setEdits((current) => {
        const next = { ...current };
        delete next[key];
        return points === null || points === original.get(key) ? next : { ...next, [key]: { eventTypeId, stageCode, points } };
      });
    },
    [original, setEdits],
  );

  const copyColumn = useCallback(
    (fromId: string, toId: string) => {
      for (const stageCode of query.data?.stageCodes ?? []) {
        const points = valueOf(fromId, stageCode);
        if (points !== null) setCell(toId, stageCode, points);
      }
    },
    [query.data, valueOf, setCell],
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
    isEdited: (eventTypeId: string, stageCode: string) => cellKey(eventTypeId, stageCode) in edits,
    valueOf,
    setCell,
    copyColumn,
    discard: () => setEdits(() => ({})),
    setKind: (value: CompetitorKind) => setParam('kind', value),
    setDraw: (value: DrawKind) => setParam('draw', value),
    setAsOf: (value: string) => setParam('asOf', value),
  };
}

/** Active event types, plus hidden ones that still hold rules in this matrix. */
export const visibleEventTypes = (matrix: RulesMatrix) =>
  matrix.eventTypes.filter((eventType) => eventType.isActive || matrix.cells.some((cell) => cell.eventTypeId === eventType.id));

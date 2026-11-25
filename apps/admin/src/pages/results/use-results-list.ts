import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from '../../components/use-debounced-value';
import { useListPageSize } from '../../providers/use-list-page-size';
import { subEventsKey, type SubEventRecord } from '../event-hub/sub-event-labels';
import { matchesKey, type MatchListItem } from './match-types';
import { sortBySlot } from './match-slot-order';
import type { PickerEvent } from './use-results-event';
import { useResultsScheduleFilter } from './use-results-schedule-filter';
import { useStoredStatusFilter } from './use-stored-status-filter';

const FALLBACK_PAGE_SIZE = 20;

export interface MatchPage {
  data: MatchListItem[];
  total: number;
}

/** Filters, server-side paging and the match query behind the results list. */
export function useResultsList(event: PickerEvent) {
  const eventId = event.id;
  const pageSize = useListPageSize() ?? FALLBACK_PAGE_SIZE;
  const [status, setStatus] = useStoredStatusFilter();
  const [subEventId, setSubEventId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const schedule = useResultsScheduleFilter(eventId, event.lifecycle === 'ONGOING');

  const subEvents = useQuery({
    queryKey: subEventsKey(eventId),
    queryFn: async () => (await apiFetch<{ data: SubEventRecord[] }>(`/admin/events/${eventId}/sub-events`)).data,
  });
  const tableOrder = useMemo(
    () => new Map((schedule.sessions.find((row) => row.id === schedule.sessionId)?.tables ?? []).map((table) => [table.tableId, table.order])),
    [schedule.sessions, schedule.sessionId],
  );
  const { sessionId, tableId } = schedule;
  const order = useCallback((data: MatchListItem[]) => (sessionId ? sortBySlot(data, tableOrder) : data), [sessionId, tableOrder]);

  const fetchPage = async (target: number): Promise<MatchPage> => {
    const params = new URLSearchParams({ page: String(target), pageSize: String(pageSize), sort: 'matchNo:asc', 'filter[status]': status });
    if (q) params.set('q', q);
    if (subEventId) params.set('filter[subEventId]', subEventId);
    if (sessionId) params.set('filter[sessionId]', sessionId);
    if (tableId) params.set('filter[tableId]', tableId);
    return apiFetch<MatchPage>(`/admin/events/${eventId}/matches?${params}`);
  };

  const matches = useQuery({
    queryKey: [...matchesKey(eventId), page, pageSize, q, status, subEventId, sessionId, tableId],
    placeholderData: keepPreviousData,
    queryFn: () => fetchPage(page),
  });
  const rows = useMemo(() => (matches.data ? order(matches.data.data) : undefined), [matches.data, order]);

  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };
  return {
    eventId,
    pageSize,
    page,
    setPage,
    status,
    search,
    subEventId,
    schedule,
    subEvents: subEvents.data ?? [],
    matches,
    rows,
    order,
    fetchPage,
    onStatus: resetPage(setStatus),
    onSubEvent: resetPage(setSubEventId),
    onSearch: resetPage(setSearch),
    onSession: resetPage(schedule.setSession),
    onTable: resetPage(schedule.setTable),
  };
}

export type ResultsList = ReturnType<typeof useResultsList>;

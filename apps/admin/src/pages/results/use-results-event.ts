import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from '../../components/use-debounced-value';
import { useListPageSize } from '../../providers/use-list-page-size';
import type { EventRecord } from '../../resources/events/event-labels';

const STORAGE_KEY = 'kamito.admin.results.eventId';
const FALLBACK_PAGE_SIZE = 20;

export type PickerEvent = Pick<EventRecord, 'id' | 'name' | 'lifecycle' | 'timezone'>;

const readStored = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const listUrl = (params: Record<string, string>) => `/admin/events?${new URLSearchParams({ page: '1', sort: 'startDate:desc', ...params })}`;

/**
 * Event picker state with server-side search: typing sends `q` to the API, the remembered event is loaded by id,
 * and without a valid remembered event the picker defaults to an ongoing event, else the most recent one.
 */
export function useResultsEvent() {
  const pageSize = String(useListPageSize() ?? FALLBACK_PAGE_SIZE);
  const [chosen, setChosen] = useState<string | null>(readStored);
  const [text, setText] = useState('');
  const q = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);

  const found = useQuery({
    queryKey: ['admin-events-picker', 'search', pageSize, q],
    queryFn: async () => (await apiFetch<{ data: PickerEvent[] }>(listUrl({ pageSize, ...(q && { q }) }))).data,
    placeholderData: keepPreviousData,
  });
  const chosenEvent = useQuery({
    queryKey: ['admin-events-picker', 'one', chosen],
    enabled: Boolean(chosen),
    retry: false,
    initialData: () => found.data?.find((event) => event.id === chosen),
    queryFn: async () => (await apiFetch<{ data: PickerEvent }>(`/admin/events/${chosen}`)).data,
  });
  const needsDefault = !chosen || chosenEvent.isError;
  const fallback = useQuery({
    queryKey: ['admin-events-picker', 'default'],
    enabled: needsDefault,
    queryFn: async () => {
      const ongoing = (await apiFetch<{ data: PickerEvent[] }>(listUrl({ pageSize: '1', 'filter[lifecycle]': 'ONGOING' }))).data[0];
      return ongoing ?? (await apiFetch<{ data: PickerEvent[] }>(listUrl({ pageSize: '1' }))).data[0] ?? null;
    },
  });

  const selected = (needsDefault ? fallback.data : chosenEvent.data) ?? undefined;
  const list = found.data ?? [];
  const options = selected && !list.some((event) => event.id === selected.id) ? [selected, ...list] : list;
  const query = needsDefault ? fallback : chosenEvent;

  const select = (id: string) => {
    setChosen(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage blocked: the choice just is not remembered.
    }
  };
  return {
    options,
    selected,
    select,
    onSearch: setText,
    searching: found.isFetching,
    isLoading: query.isLoading || (!selected && found.isLoading),
    isError: (needsDefault && fallback.isError) || (found.isError && !selected),
    refetch: () => Promise.all([found.refetch(), needsDefault ? fallback.refetch() : chosenEvent.refetch()]),
  };
}

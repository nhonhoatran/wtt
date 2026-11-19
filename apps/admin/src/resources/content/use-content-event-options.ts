import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from '../../components/use-debounced-value';
import { useListPageSize } from '../../providers/use-list-page-size';

interface EventOption { id: string; name: string }

export function useContentEventOptions(selected: string[] = []) {
  const pageSize = useListPageSize();
  const [text, setText] = useState('');
  const q = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);
  const query = useQuery({
    queryKey: ['content-events', pageSize, q],
    queryFn: async () => {
      const params = new URLSearchParams({ sort: 'startDate:desc', ...(q && { q }), ...(pageSize && { pageSize: String(pageSize) }) });
      return (await apiFetch<{ data: EventOption[] }>(`/admin/events?${params}`)).data;
    },
    placeholderData: keepPreviousData,
  });
  const matches = query.data ?? [];
  const ids = new Set(matches.map(({ id }) => id));
  const missing = useQueries({
    queries: selected.filter((id) => !ids.has(id)).map((id) => ({
      queryKey: ['content-events', id],
      retry: false,
      queryFn: async () => (await apiFetch<{ data: EventOption }>(`/admin/events/${encodeURIComponent(id)}`)).data,
    })),
  });
  const options = [...matches, ...missing.flatMap(({ data }) => data ? [data] : [])].map(({ id, name }) => ({ value: id, label: name }));
  return { options, showSearch: true as const, filterOption: false as const, loading: query.isFetching, onSearch: setText };
}

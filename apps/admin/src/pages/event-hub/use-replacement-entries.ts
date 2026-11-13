import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { useListPageSize } from '../../providers/use-list-page-size';
import type { EntryRecord } from './entry-labels';

const SEARCH_DEBOUNCE_MS = 300;

/** Confirmed entries of the sub-event that are not in the draw yet, searched on the server. */
export function useReplacementEntries(subEventId: string, enabled: boolean, takenEntryIds: Set<string>) {
  const pageSize = useListPageSize();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const results = useQuery({
    queryKey: ['admin-draw-replacement-entries', subEventId, pageSize, q],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({ 'filter[status]': 'CONFIRMED', ...(pageSize && { pageSize: String(pageSize) }), ...(q && { q }) });
      return (await apiFetch<{ data: EntryRecord[] }>(`/admin/sub-events/${subEventId}/entries?${params}`)).data;
    },
  });

  const options = (results.data ?? []).filter((entry) => !takenEntryIds.has(entry.id)).map((entry) => ({ value: entry.id, label: entry.competitor.displayName }));
  return { options, onSearch: setText, loading: results.isFetching, failed: results.isError };
}

import { keepPreviousData, useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { useListPageSize } from '../../providers/use-list-page-size';
import { SEARCH_DEBOUNCE_MS } from '../../components/use-debounced-value';

export interface CatalogRow {
  id: string;
  name: string;
  isDefault?: boolean;
  [key: string]: unknown;
}

export interface CatalogOption {
  value: string;
  label: string;
}

/** Prefix of every catalog query key, so one call refreshes all option lists. */
const CATALOG_QUERY_KEY = 'catalog-rows';
/** Used until /auth/me reports the page size set on /settings. */
const FALLBACK_PAGE_SIZE = 20;
/** Option lists may be a few seconds old; catalog edits invalidate them explicitly. */
const STALE_MS = 60_000;

interface ListResponse {
  data: CatalogRow[];
  total: number;
}

/** `filter[isActive]` defaults to true; an explicit empty value (filters `{ isActive: '' }`) lists hidden rows too. */
const listUrl = (resource: string, params: Record<string, string>) => {
  const search = new URLSearchParams({ 'filter[isActive]': 'true', ...params });
  if (search.get('filter[isActive]') === '') search.delete('filter[isActive]');
  return `/admin/${resource}?${search}`;
};

const filterParams = (filters: Record<string, string>) => Object.fromEntries(Object.entries(filters).map(([key, value]) => [`filter[${key}]`, value]));

export const invalidateCatalogOptions = (client: QueryClient) => client.invalidateQueries({ queryKey: [CATALOG_QUERY_KEY] });

/** For catalog create/edit/hide/delete handlers: option lists elsewhere must not keep showing stale rows. */
export function useInvalidateCatalogOptions() {
  const client = useQueryClient();
  return () => invalidateCatalogOptions(client);
}

/** Every active row, fetched page by page, for pickers that show all choices at once. `filters` adds `filter[key]=value` to the request. */
export function useCatalogRows(resource: string, filters: Record<string, string> = {}, enabled = true) {
  const pageSize = useListPageSize() ?? FALLBACK_PAGE_SIZE;
  return useQuery({
    queryKey: [CATALOG_QUERY_KEY, resource, 'all', pageSize, filters],
    enabled,
    queryFn: async () => {
      const rows: CatalogRow[] = [];
      for (let page = 1; ; page += 1) {
        const res = await apiFetch<ListResponse>(listUrl(resource, { ...filterParams(filters), page: String(page), pageSize: String(pageSize) }));
        rows.push(...res.data);
        if (res.data.length === 0 || rows.length >= res.total) return rows;
      }
    },
    staleTime: STALE_MS,
  });
}

/** The row flagged isDefault (match format, scoring rule), used to pre-fill forms. */
export function useDefaultCatalogRow(resource: string) {
  return useQuery({
    queryKey: [CATALOG_QUERY_KEY, resource, 'default'],
    queryFn: async () => (await apiFetch<ListResponse>(listUrl(resource, { 'filter[isDefault]': 'true', pageSize: '1' }))).data[0] ?? null,
    staleTime: STALE_MS,
  });
}

interface CatalogSelectOptions {
  labelOf?: (row: CatalogRow) => string;
  /** Value(s) already chosen; their labels are fetched by id when they are not in the current search page. */
  selected?: string | string[] | null;
}

const defaultLabel = (row: CatalogRow) => row.name;

/**
 * Select props backed by server-side search: typing sends `q` to the API, so lists longer than one page stay reachable.
 * Spread `selectProps` onto an antd Select.
 */
export function useCatalogSelect(resource: string, { labelOf = defaultLabel, selected }: CatalogSelectOptions = {}) {
  const pageSize = useListPageSize() ?? FALLBACK_PAGE_SIZE;
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const labels = useRef(new Map<string, string>());

  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const results = useQuery({
    queryKey: [CATALOG_QUERY_KEY, resource, 'search', pageSize, q],
    queryFn: async () => (await apiFetch<ListResponse>(listUrl(resource, { pageSize: String(pageSize), ...(q && { q }) }))).data,
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
  results.data?.forEach((row) => labels.current.set(row.id, labelOf(row)));

  const wanted = [selected ?? []].flat().filter((id) => !labels.current.has(id));
  const fetched = useQueries({
    queries: wanted.map((id) => ({
      queryKey: [CATALOG_QUERY_KEY, resource, 'one', id],
      queryFn: async () => (await apiFetch<{ data: CatalogRow }>(`/admin/${resource}/${id}`)).data,
      staleTime: STALE_MS,
    })),
  });
  fetched.forEach((result) => result.data && labels.current.set(result.data.id, labelOf(result.data)));

  const found = (results.data ?? []).map((row) => ({ value: row.id, label: labelOf(row) }));
  const extra = [selected ?? []]
    .flat()
    .filter((id) => !found.some((option) => option.value === id) && labels.current.has(id))
    .map((id) => ({ value: id, label: labels.current.get(id)! }));
  const options: CatalogOption[] = [...extra, ...found];

  return {
    options,
    selectProps: { showSearch: true, filterOption: false, onSearch: setText, loading: results.isFetching, options },
  };
}

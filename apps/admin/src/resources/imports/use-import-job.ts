import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../api/http-client';
import { BUSY_STATUSES, IMPORT_POLL_MS, importKey, type ImportJob } from './import-labels';

/** Follows one import job; polls while a worker is busy so the page survives a reload. */
export function useImportJob(id: string) {
  return useQuery({
    queryKey: importKey(id),
    queryFn: async () => (await apiFetch<{ data: ImportJob }>(`/admin/imports/${encodeURIComponent(id)}`)).data,
    refetchInterval: (query) => (query.state.data && BUSY_STATUSES.includes(query.state.data.status) ? IMPORT_POLL_MS : false),
    retry: false,
  });
}

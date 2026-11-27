import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../api/http-client';

interface RankingDateContext {
  today: string;
  timeZone: string;
}

/** Refresh across business midnight without using the browser's local calendar or settings permissions. */
export function useRankingDateContext(enabled = true) {
  const query = useQuery({
    // Reopening starts a new observer baseline, so yesterday's cache cannot initialize the form.
    queryKey: ['admin-ranking-date-context', enabled],
    queryFn: async () => (await apiFetch<{ data: RankingDateContext }>('/admin/ranking/context')).data,
    enabled,
    staleTime: 0,
    refetchInterval: 60_000,
  });
  const [freshness, setFreshness] = useState({ enabled, ready: false });
  if (freshness.enabled !== enabled) setFreshness({ enabled, ready: false });
  else if (enabled && query.isFetchedAfterMount && query.isSuccess && !freshness.ready) {
    setFreshness({ enabled, ready: true });
  }
  // A modal must get a fresh date when opened, even when another ranking page populated the cache yesterday.
  // After initialization, retain its form values through background refresh errors.
  return { ...query, data: enabled && freshness.enabled === enabled && freshness.ready ? query.data : undefined };
}

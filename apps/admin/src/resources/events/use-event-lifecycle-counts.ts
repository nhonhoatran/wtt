import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../api/http-client';
import type { LifecycleCounts } from './event-labels';

export interface EventCountFilters {
  q?: string;
  year?: string;
  eventTypeId?: string;
  publishStatus?: string;
}

/** Tab counts follow every list filter except the lifecycle tab itself. */
export function useEventLifecycleCounts(filters: EventCountFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  for (const key of ['year', 'eventTypeId', 'publishStatus'] as const) {
    if (filters[key]) params.set(`filter[${key}]`, filters[key]);
  }
  return useQuery({
    queryKey: ['event-lifecycle-counts', params.toString()],
    queryFn: async () => (await apiFetch<{ data: LifecycleCounts }>(`/admin/events/lifecycle-counts?${params}`)).data,
    placeholderData: keepPreviousData,
  });
}

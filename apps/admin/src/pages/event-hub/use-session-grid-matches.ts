import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../api/http-client';
import { scheduleKey, type ScheduleMatch } from './schedule-types';

/** All matches of one session; the grid and the status bar read the same cached query. */
export function useSessionGridMatches(eventId: string, sessionId: string) {
  return useQuery({
    queryKey: [...scheduleKey(eventId), 'grid', sessionId],
    queryFn: async () =>
      apiFetch<{ data: ScheduleMatch[]; total: number; truncated?: boolean }>(`/admin/events/${eventId}/matches?${new URLSearchParams({ 'filter[sessionId]': sessionId })}`),
  });
}

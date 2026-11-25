import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiFetch } from '../../api/http-client';
import { drawsOverviewKey } from './draw-labels';
import { entryCountsKey } from './entry-labels';
import { watchEventDataChanges } from './event-progress-signals';
import type { EventProgress } from './event-progress-steps';
import { scheduleKey, sessionsKey } from './schedule-types';
import { subEventsKey } from './sub-event-labels';

export const eventProgressKey = (eventId: string) => ['admin-event-progress', eventId];

/** Per-event queries whose data moves when a tab writes; a real change there may move the progress counts. */
const WRITE_SIGNAL_ROOTS = new Set<unknown>([
  drawsOverviewKey('')[0],
  entryCountsKey('')[0],
  scheduleKey('')[0],
  sessionsKey('')[0],
  subEventsKey('')[0],
]);

export function useEventProgress(eventId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: eventProgressKey(eventId),
    queryFn: async () => (await apiFetch<{ data: EventProgress }>(`/admin/events/${encodeURIComponent(eventId)}/progress`)).data,
    retry: false,
  });

  useEffect(
    () =>
      watchEventDataChanges(queryClient, eventId, WRITE_SIGNAL_ROOTS, () => {
        if (queryClient.getQueryState(eventProgressKey(eventId))?.status === 'success') {
          void queryClient.invalidateQueries({ queryKey: eventProgressKey(eventId) });
        }
      }),
    [queryClient, eventId],
  );

  return query;
}

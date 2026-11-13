import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../api/http-client';
import type { EventRecord } from '../../resources/events/event-labels';

const STORAGE_KEY = 'kamito.admin.results.eventId';
const PICKER_PAGE_SIZE = 100;

export type PickerEvent = Pick<EventRecord, 'id' | 'name' | 'lifecycle'>;

const readStored = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/** Event picker state: remembers the last choice, otherwise defaults to an ongoing event. */
export function useResultsEvent() {
  const [chosen, setChosen] = useState<string | null>(readStored);
  const events = useQuery({
    queryKey: ['admin-events-picker'],
    queryFn: async () =>
      (await apiFetch<{ data: PickerEvent[] }>(`/admin/events?${new URLSearchParams({ page: '1', pageSize: String(PICKER_PAGE_SIZE), sort: 'startDate:desc' })}`)).data,
  });
  const list = events.data ?? [];
  const selected = list.find((event) => event.id === chosen) ?? list.find((event) => event.lifecycle === 'ONGOING') ?? list[0];

  const select = (id: string) => {
    setChosen(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage blocked: the choice just is not remembered.
    }
  };
  return { events, list, selected, select };
}

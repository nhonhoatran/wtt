import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { sessionsKey, tableLabel, type SessionRecord } from '../event-hub/schedule-types';

const TABLE_STORAGE_PREFIX = 'kamito.admin.results.tableId.';

const storageKey = (eventId: string) => `${TABLE_STORAGE_PREFIX}${eventId}`;

const readStoredTable = (eventId: string): string | undefined => {
  try {
    return localStorage.getItem(storageKey(eventId)) ?? undefined;
  } catch {
    return undefined;
  }
};

const writeStoredTable = (eventId: string, tableId: string | undefined) => {
  try {
    if (tableId) localStorage.setItem(storageKey(eventId), tableId);
    else localStorage.removeItem(storageKey(eventId));
  } catch {
    // Storage blocked: the choice just is not remembered.
  }
};

type TimedSession = SessionRecord & { startsAt: string };

/** The latest session already started, else the first upcoming one; compared as instants, so any browser timezone works. */
export function currentSession(sessions: readonly SessionRecord[], now = Date.now()): SessionRecord | undefined {
  const sorted = (sessions as readonly TimedSession[]).toSorted((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return sorted.findLast((session) => Date.parse(session.startsAt) <= now) ?? sorted[0];
}

/**
 * Session and table filters for the results list. Session defaults to the current one of an ongoing event
 * (until the user picks or clears it); the table choice is remembered per event.
 */
export function useResultsScheduleFilter(eventId: string | undefined, ongoing: boolean) {
  const [sessionChoice, setSessionChoice] = useState<{ eventId: string; id: string | null } | null>(null);
  const [tableChoice, setTableChoice] = useState<{ eventId: string; id: string | undefined } | null>(null);
  const query = useQuery({
    queryKey: sessionsKey(eventId ?? ''),
    enabled: Boolean(eventId),
    queryFn: async () => (await apiFetch<{ data: SessionRecord[] }>(`/admin/events/${eventId}/sessions`)).data,
  });
  const sessions = useMemo(() => query.data ?? [], [query.data]);

  const chosen = sessionChoice && sessionChoice.eventId === eventId ? sessionChoice.id : undefined;
  const sessionId = chosen === undefined ? (ongoing ? currentSession(sessions)?.id : undefined) : (chosen ?? undefined);
  const session = sessions.find((row) => row.id === sessionId);

  const tables = useMemo(() => {
    const source = session ? session.tables : sessions.flatMap((row) => row.tables);
    const unique = new Map(source.map((table) => [table.tableId, table]));
    return [...unique.values()].sort((a, b) => a.order - b.order).map((table) => ({ value: table.tableId, label: tableLabel(table) }));
  }, [session, sessions]);

  const wantedTable = tableChoice && tableChoice.eventId === eventId ? tableChoice.id : eventId ? readStoredTable(eventId) : undefined;
  const tableId = tables.some((option) => option.value === wantedTable) ? wantedTable : undefined;

  return {
    sessions,
    sessionId,
    tableId,
    tables,
    setSession: (id: string | undefined) => eventId && setSessionChoice({ eventId, id: id ?? null }),
    setTable: (id: string | undefined) => {
      if (!eventId) return;
      setTableChoice({ eventId, id });
      writeStoredTable(eventId, id);
    },
  };
}

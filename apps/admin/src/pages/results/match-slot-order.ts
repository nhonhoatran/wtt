import { apiFetch } from '../../api/http-client';
import { firstOpenMatch, type MatchListItem } from './match-types';

/** Table by its column order in the session, then slot order, then match number; unplaced matches go last. */
export function sortBySlot(rows: readonly MatchListItem[], tableOrder: ReadonlyMap<string, number>): MatchListItem[] {
  const rank = (row: MatchListItem) => (row.tableId ? (tableOrder.get(row.tableId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER);
  const slot = (row: MatchListItem) => row.orderInSession ?? Number.MAX_SAFE_INTEGER;
  return rows.toSorted((a, b) => rank(a) - rank(b) || slot(a) - slot(b) || a.matchNo - b.matchNo);
}

interface NextOnTableQuery {
  eventId: string;
  tableId: string;
  sessionId?: string;
  pageSize: number;
}

/** The next playable match on the table that just finished one, or undefined when that table has none left. */
export async function nextOnTable({ eventId, tableId, sessionId, pageSize }: NextOnTableQuery): Promise<MatchListItem | undefined> {
  const params = new URLSearchParams({ page: '1', pageSize: String(pageSize), sort: 'scheduledAt:asc', 'filter[status]': 'OPEN', 'filter[tableId]': tableId });
  if (sessionId) params.set('filter[sessionId]', sessionId);
  const { data } = await apiFetch<{ data: MatchListItem[] }>(`/admin/events/${eventId}/matches?${params}`);
  return firstOpenMatch(data);
}

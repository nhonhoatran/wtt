import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../api/http-client';
import type { BoardPrevious } from './ranking-board-labels';
import type { SnapshotRecord } from './ranking-snapshots-page';

export type BoardSnapshot = SnapshotRecord & { createdAt: string };

export interface BoardSummary {
  rows: number;
  changed: number;
  newcomers: number;
  expiredPoints: number;
  previous: BoardPrevious | null;
}

export const currentSnapshotKey = (listId: string | null) => ['admin-ranking-board', 'current', listId];
export const summaryKey = (snapshotId: string | undefined) => ['admin-ranking-board', 'summary', snapshotId];

const latest = async (listId: string, status: 'DRAFT' | 'PUBLISHED') => {
  const query = new URLSearchParams({ 'filter[listId]': listId, 'filter[status]': status, sort: 'asOfDate:desc', pageSize: '1' });
  return (await apiFetch<{ data: BoardSnapshot[] }>(`/admin/ranking-snapshots?${query}`)).data[0] ?? null;
};

/** The working copy of a list: its newest draft, otherwise its newest published snapshot, otherwise null. */
export function useCurrentSnapshot(listId: string | null) {
  return useQuery({
    queryKey: currentSnapshotKey(listId),
    enabled: listId !== null,
    queryFn: async () => (await latest(listId!, 'DRAFT')) ?? (await latest(listId!, 'PUBLISHED')),
  });
}

export function useBoardSummary(snapshotId: string | undefined) {
  return useQuery({
    queryKey: summaryKey(snapshotId),
    enabled: Boolean(snapshotId),
    queryFn: async () => (await apiFetch<{ data: BoardSummary }>(`/admin/ranking-snapshots/${encodeURIComponent(snapshotId!)}/summary`)).data,
  });
}

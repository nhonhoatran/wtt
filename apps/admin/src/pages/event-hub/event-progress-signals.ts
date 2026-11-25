import type { QueryClient, QueryKey } from '@tanstack/react-query';

const COALESCE_MS = 150;

/**
 * Calls `onSignal` when data of a query of this event (queryKey = [root, eventId, ...]) really changed
 * after a refetch. The first load and refetches that return identical data (window focus) are ignored;
 * bursts are coalesced into one call.
 */
export function watchEventDataChanges(
  queryClient: QueryClient,
  eventId: string,
  roots: ReadonlySet<unknown>,
  onSignal: () => void,
): () => void {
  const cache = queryClient.getQueryCache();
  const isWatched = (key: QueryKey) => roots.has(key[0]) && key[1] === eventId;
  const lastSeen = new Map<string, unknown>();
  for (const query of cache.getAll()) {
    if (isWatched(query.queryKey)) lastSeen.set(query.queryHash, query.state.data);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = cache.subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    const { queryKey, queryHash, state } = event.query;
    if (!isWatched(queryKey)) return;
    const known = lastSeen.has(queryHash);
    const previous = lastSeen.get(queryHash);
    lastSeen.set(queryHash, state.data);
    if (!known || previous === state.data) return;
    clearTimeout(timer);
    timer = setTimeout(onSignal, COALESCE_MS);
  });
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}

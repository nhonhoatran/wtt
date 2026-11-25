export type NavTarget = { kind: 'row'; id: string } | { kind: 'page'; page: number; pick: 'first' | 'last' };

export interface MatchNavigation {
  /** 1-based position in the whole filtered list. */
  position: number;
  total: number;
  prev: NavTarget | null;
  next: NavTarget | null;
}

/** Previous/next match in the filtered list; at a page edge the target is the neighbouring page. Null when the match is not on this page. */
export function matchNavigation(ids: readonly string[], currentId: string | null, page: number, pageSize: number, total: number): MatchNavigation | null {
  const index = currentId ? ids.indexOf(currentId) : -1;
  if (index < 0) return null;
  const prevId = ids[index - 1];
  const nextId = ids[index + 1];
  const prev: NavTarget | null = prevId ? { kind: 'row', id: prevId } : page > 1 ? { kind: 'page', page: page - 1, pick: 'last' } : null;
  const next: NavTarget | null = nextId ? { kind: 'row', id: nextId } : page * pageSize < total ? { kind: 'page', page: page + 1, pick: 'first' } : null;
  return { position: (page - 1) * pageSize + index + 1, total, prev, next };
}

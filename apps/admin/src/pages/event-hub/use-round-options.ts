import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../api/http-client';
import { DRAW_KIND_LABELS, overviewOf, roundTitle } from './draw-labels';
import type { BracketData, DrawKind, DrawOverviewRow, GroupsData } from './draw-types';

export interface RoundOption {
  /** Round ids joined by comma: the API accepts a list, and group rounds repeat per group. */
  value: string;
  label: string;
}

/** Rounds of a sub-event's published draws, so the panel can filter by round without a cross-draw round endpoint. */
export function useRoundOptions(eventId: string, subEventId: string | undefined) {
  return useQuery({
    queryKey: ['admin-schedule-rounds', eventId, subEventId],
    enabled: Boolean(subEventId),
    queryFn: async (): Promise<RoundOption[]> => {
      const overview = await apiFetch<{ data: DrawOverviewRow[] }>(`/admin/events/${eventId}/draws`);
      const draws = (overviewOf(overview.data, subEventId!)?.draws ?? []).filter((draw) => draw.status === 'PUBLISHED');
      const rounds = await Promise.all(
        draws.map(async (draw) => {
          const found: { id: string; code: string; kind: DrawKind }[] = [];
          if (draw.kind === 'GROUP') {
            const { data } = await apiFetch<{ data: GroupsData }>(`/admin/draws/${draw.id}/groups`);
            data.groups.flatMap((group) => group.matches).forEach((m) => found.push({ id: m.roundId, code: m.roundCode, kind: draw.kind }));
          } else {
            const { data } = await apiFetch<{ data: BracketData }>(`/admin/draws/${draw.id}/bracket`);
            data.rounds.forEach((round) => found.push({ id: round.id, code: round.code, kind: draw.kind }));
          }
          return found;
        }),
      );
      const byLabel = new Map<string, { ids: Set<string> }>();
      const labelled = draws.length > 1;
      rounds.flat().forEach((round) => {
        const label = labelled ? `${roundTitle(round.code)} · ${DRAW_KIND_LABELS[round.kind]}` : roundTitle(round.code);
        const entry = byLabel.get(label) ?? { ids: new Set<string>() };
        entry.ids.add(round.id);
        byLabel.set(label, entry);
      });
      return [...byLabel.entries()].map(([label, { ids }]) => ({ value: [...ids].join(','), label }));
    },
  });
}


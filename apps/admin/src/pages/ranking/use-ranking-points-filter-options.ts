import { useSelect } from '@refinedev/antd';
import type { CrudFilters } from '@refinedev/core';
import { getDefaultFilter } from '@refinedev/core';
import { playerCodeName } from '../../resources/players/player-labels';
import { useListPageSize } from '../../providers/use-list-page-size';

interface Option {
  value: string;
  label: string;
}

const toOptions = (options: { value?: unknown; label?: unknown }[] | undefined): Option[] =>
  (options ?? []).map((option) => ({ value: String(option.value), label: String(option.label) }));

const searchBy = (text: string) => [{ field: 'q', operator: 'contains' as const, value: text }];

/** Server-searched option lists for the ledger filter bar; the applied filter is passed so its label still shows after a reload. */
export function useRankingPointsFilterOptions(filters: CrudFilters) {
  const pageSize = useListPageSize();
  const applied = (field: string) => getDefaultFilter(field, filters, 'eq') as string | undefined;

  const lists = useSelect<{ id: string; code: string; name: string }>({
    resource: 'ranking-lists',
    optionValue: 'id',
    optionLabel: (row) => `${row.code} – ${row.name}`,
    pagination: { pageSize },
    defaultValue: applied('rankingListId'),
    onSearch: searchBy,
  }).selectProps;
  const players = useSelect<{ id: string; code: string; fullName: string }>({
    resource: 'players',
    optionValue: 'id',
    optionLabel: (row) => playerCodeName(row),
    pagination: { pageSize },
    defaultValue: applied('playerId'),
    onSearch: searchBy,
  }).selectProps;
  const events = useSelect<{ id: string; name: string }>({
    resource: 'events',
    optionValue: 'id',
    optionLabel: 'name',
    pagination: { pageSize },
    defaultValue: applied('eventId'),
    onSearch: searchBy,
  }).selectProps;

  return {
    lists: { options: toOptions(lists.options), onSearch: lists.onSearch },
    players: { options: toOptions(players.options), onSearch: players.onSearch },
    events: { options: toOptions(events.options), onSearch: events.onSearch },
  };
}

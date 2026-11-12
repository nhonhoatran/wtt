import { useQuery } from '@tanstack/react-query';
import { Select, Spin, type RefSelectProps } from 'antd';
import { useEffect, useState, type CSSProperties, type KeyboardEvent, type Ref } from 'react';
import { apiFetch } from '../api/http-client';
import { playerOptionLabel, type Gender, type PlayerLookupItem } from '../resources/players/player-labels';

const LOOKUP_LIMIT = 10;
const LOOKUP_DEBOUNCE_MS = 300;
const NEW_OPTION = '__new__';

export interface PlayerLookupSelectProps {
  value?: PlayerLookupItem | null;
  onChange: (player: PlayerLookupItem | null) => void;
  gender?: Gender;
  excludeIds?: string[];
  /** Shows "Tạo VĐV mới với tên này" when given. */
  onCreateNew?: (name: string) => void;
  /** Enter pressed while a player is picked and the list is closed. */
  onEnter?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  status?: 'error';
  selectRef?: Ref<RefSelectProps>;
  style?: CSSProperties;
  'aria-label'?: string;
}

function useDebounced(text: string): string {
  const [value, setValue] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => setValue(text), LOOKUP_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);
  return value;
}

/** Search-as-you-type over /admin/players/lookup (name or code), pre-filtered by gender when given. */
export function PlayerLookupSelect({ value, onChange, gender, excludeIds, onCreateNew, onEnter, selectRef, ...rest }: PlayerLookupSelectProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const q = useDebounced(search.trim());
  const { data, isFetching } = useQuery({
    queryKey: ['player-lookup', q, gender],
    enabled: q.length > 0,
    queryFn: async () => {
      const params = new URLSearchParams({ q, limit: String(LOOKUP_LIMIT) });
      if (gender) params.set('gender', gender);
      return (await apiFetch<{ data: PlayerLookupItem[] }>(`/admin/players/lookup?${params}`)).data;
    },
  });
  const found = (q ? (data ?? []) : []).filter((player) => !excludeIds?.includes(player.id));
  const rows = value && !found.some((player) => player.id === value.id) ? [value, ...found] : found;
  const options = rows.map((player) => ({ value: player.id, label: playerOptionLabel(player) }));
  const typed = search.trim();
  if (onCreateNew && typed && q === typed && !isFetching && found.length === 0) {
    options.push({ value: NEW_OPTION, label: `+ Tạo VĐV mới với tên "${typed}"` });
  }

  const select = (id: string) => {
    setSearch('');
    if (id === NEW_OPTION) onCreateNew?.(typed);
    else onChange(rows.find((player) => player.id === id) ?? null);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && value && !open && !search && onEnter) {
      event.preventDefault();
      onEnter();
    }
  };

  return (
    <Select
      {...rest}
      ref={selectRef}
      showSearch
      allowClear
      filterOption={false}
      value={value?.id}
      searchValue={search}
      onSearch={setSearch}
      onSelect={select}
      onClear={() => onChange(null)}
      onOpenChange={setOpen}
      onInputKeyDown={onKeyDown}
      options={options}
      notFoundContent={isFetching ? <Spin size="small" /> : q ? 'Không thấy VĐV nào' : 'Gõ tên hoặc mã VĐV'}
    />
  );
}

import { getDefaultFilter, type CrudFilter, type CrudFilters } from '@refinedev/core';
import { Button, DatePicker, Flex, Grid, Input, Select, theme } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';

export type FilterFieldDef =
  | { kind: 'search'; field: string; placeholder: string }
  | { kind: 'select'; field: string; placeholder: string; options: { value: string; label: string }[]; showSearch?: boolean; onSearch?: (text: string) => void }
  | { kind: 'dateRange'; fromField: string; toField: string; placeholder: [string, string] };

interface ListFilterBarProps {
  fields: FilterFieldDef[];
  filters: CrudFilters;
  setFilters: (filters: CrudFilters, behavior?: 'merge' | 'replace') => void;
}

const eq = (field: string, value: unknown): CrudFilter => ({ field, operator: 'eq', value });

const SEARCH_WIDTH = 280;
const SELECT_MIN_WIDTH = 160;

/** Keeps typed text while focused, but follows the applied filter (e.g. after "Xóa lọc"). */
function SearchInput({ placeholder, applied, onSearch, compact }: { placeholder: string; applied?: string; onSearch: (value: string) => void; compact: boolean }) {
  const [text, setText] = useState(applied ?? '');
  useEffect(() => setText(applied ?? ''), [applied]);
  return (
    <Input.Search
      allowClear
      placeholder={placeholder}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onSearch={onSearch}
      style={{ width: compact ? '100%' : SEARCH_WIDTH }}
    />
  );
}

/** The one filter row above every admin table. Each change resets to page 1 (Refine's default). */
export function ListFilterBar({ fields, filters, setFilters }: ListFilterBarProps) {
  const { token } = theme.useToken();
  // Phones: the search takes a full row and the other filters share rows instead of leaving half the width empty.
  const compact = Grid.useBreakpoint().md === false;
  // Bumped by "Xóa lọc" so the search box also drops text typed but not yet submitted.
  const [clearCount, setClearCount] = useState(0);
  const clearAll = () => {
    setFilters([], 'replace');
    setClearCount((count) => count + 1);
  };
  const current = (field: string) => getDefaultFilter(field, filters, 'eq') as string | undefined;
  const set = (next: CrudFilter[]) => setFilters(next, 'merge');
  const hasAny = filters.some((filter) => 'value' in filter && filter.value !== undefined && filter.value !== '');

  return (
    <Flex wrap gap="small" style={{ marginBottom: token.margin }}>
      {fields.map((def) => {
        if (def.kind === 'search') {
          return (
            <SearchInput
              key={`${def.field}:${clearCount}`}
              placeholder={def.placeholder}
              applied={current(def.field)}
              onSearch={(value) => set([eq(def.field, value.trim() || undefined)])}
              compact={compact}
            />
          );
        }
        if (def.kind === 'select') {
          return (
            <Select
              key={def.field}
              allowClear
              showSearch={def.showSearch}
              filterOption={def.onSearch ? false : undefined}
              onSearch={def.onSearch}
              placeholder={def.placeholder}
              value={current(def.field)}
              options={def.options}
              onChange={(value) => set([eq(def.field, value)])}
              style={{ minWidth: SELECT_MIN_WIDTH, flex: compact ? `1 1 ${SELECT_MIN_WIDTH}px` : undefined }}
            />
          );
        }
        const from = current(def.fromField);
        const to = current(def.toField);
        return (
          <DatePicker.RangePicker
            key={def.fromField}
            placeholder={def.placeholder}
            format="DD/MM/YYYY"
            value={from || to ? [from ? dayjs(from) : null, to ? dayjs(to) : null] : null}
            onChange={(range: [Dayjs | null, Dayjs | null] | null) =>
              set([
                eq(def.fromField, range?.[0]?.startOf('day').toISOString()),
                eq(def.toField, range?.[1]?.endOf('day').toISOString()),
              ])
            }
          />
        );
      })}
      {hasAny && <Button onClick={clearAll}>Xóa lọc</Button>}
    </Flex>
  );
}

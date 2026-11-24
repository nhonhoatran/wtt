import { getDefaultSortOrder, List, useTable } from '@refinedev/antd';
import { getDefaultFilter } from '@refinedev/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { apiFetch } from '../../api/http-client';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useListPageSize } from '../../providers/use-list-page-size';
import { IMPORT_STATUS_COLORS, IMPORT_STATUS_LABELS, IMPORT_STATUS_OPTIONS, type ImportJob } from './import-labels';
import { SEARCH_DEBOUNCE_MS } from '../../components/use-debounced-value';
import { useTableScroll } from '../../components/use-table-scroll';

const formatTime = (value: string | null) => (value ? dayjs(value).format('HH:mm DD/MM/YYYY') : '—');
const count = (value: number | null) => value ?? '—';

/** Event picker for the filter: searched on the server; the chosen event's name is fetched when it is off the page. */
function useEventOptions(selected?: string) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);
  const found = useQuery({
    queryKey: ['import-filter-events', q],
    queryFn: async () => (await apiFetch<{ data: { id: string; name: string }[] }>(`/admin/events?${new URLSearchParams({ page: '1', ...(q && { q }) })}`)).data,
    placeholderData: keepPreviousData,
  }).data ?? [];
  const chosen = useQuery({
    queryKey: ['admin-event', selected],
    enabled: Boolean(selected) && !found.some((event) => event.id === selected),
    queryFn: async () => (await apiFetch<{ data: { id: string; name: string } }>(`/admin/events/${selected}`)).data,
  }).data;
  const rows = chosen && !found.some((event) => event.id === chosen.id) ? [chosen, ...found] : found;
  return { options: rows.map((event) => ({ value: event.id, label: event.name })), onSearch: setText };
}

export function ImportList() {
  const tableScroll = useTableScroll();
  const pageSize = useListPageSize();
  const { tableProps, sorters, filters, setFilters } = useTable<ImportJob>({
    resource: 'imports',
    syncWithLocation: true,
    pagination: { pageSize },
    sorters: { initial: [{ field: 'createdAt', order: 'desc' }] },
  });
  const events = useEventOptions(getDefaultFilter('eventId', filters, 'eq') as string | undefined);

  return (
    <List title="Lịch sử import">
      <ListFilterBar
        filters={filters}
        setFilters={setFilters}
        fields={[
          { kind: 'select', field: 'eventId', placeholder: 'Giải', options: events.options, showSearch: true, onSearch: events.onSearch },
          { kind: 'select', field: 'status', placeholder: 'Trạng thái', options: IMPORT_STATUS_OPTIONS },
        ]}
      />
      <Table {...tableProps} rowKey="id" scroll={tableScroll}>
        <Table.Column<ImportJob>
          dataIndex="createdAt"
          title="Thời điểm"
          sorter
          defaultSortOrder={getDefaultSortOrder('createdAt', sorters)}
          render={(value: string, job) => <Link to={`/imports/${job.id}`}>{formatTime(value)}</Link>}
        />
        <Table.Column<ImportJob> key="event" title="Giải" render={(_, job) => <Link to={`/events/${job.eventId}/entries`}>{job.event.name}</Link>} />
        <Table.Column<ImportJob> dataIndex="fileName" title="File" />
        <Table.Column<ImportJob>
          dataIndex="status"
          title="Trạng thái"
          render={(status: ImportJob['status']) => <Tag color={IMPORT_STATUS_COLORS[status]}>{IMPORT_STATUS_LABELS[status]}</Tag>}
        />
        <Table.Column<ImportJob> dataIndex="totalRows" title="Tổng dòng" align="right" render={count} />
        <Table.Column<ImportJob> dataIndex="errorRows" title="Lỗi" align="right" render={count} />
        <Table.Column<ImportJob> dataIndex="committedRows" title="Đã nhập" align="right" render={count} />
        <Table.Column<ImportJob> dataIndex="finishedAt" title="Xong lúc" render={formatTime} />
      </Table>
    </List>
  );
}

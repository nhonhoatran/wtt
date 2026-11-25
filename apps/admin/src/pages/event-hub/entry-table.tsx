import { useTable } from '@refinedev/antd';
import { App, Card, Flex, Table, theme } from 'antd';
import { useRef, useState, type Key, type ReactNode } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { ListFilterBar, type FilterFieldDef } from '../../components/list-filter-bar';
import { useTableScroll } from '../../components/use-table-scroll';
import { useListPageSize } from '../../providers/use-list-page-size';
import { entryColumns } from './entry-columns';
import { EntryBulkBar } from './entry-bulk-bar';
import { ENTRY_STAGE_OPTIONS, ENTRY_STATUS_OPTIONS, QUOTA_OPTIONS, showWarnings, type EntryRecord, type EntrySubEvent, type EntryWriteResult } from './entry-labels';
import { entryUnit } from './sub-event-labels';

export const entriesResource = (subEventId: string) => `sub-events/${subEventId}/entries`;

interface EntryTableProps {
  subEvent: EntrySubEvent;
  canUpdate: boolean;
  /** Pill counts change with every status write. */
  onCountsChanged: () => Promise<unknown>;
  /** Buttons shown on the right of the filter row. */
  toolbarActions?: ReactNode;
  /** Add form / import panel, shown between the filter row and the table. */
  panel?: ReactNode;
}

export function EntryTable({ subEvent, canUpdate, onCountsChanged, toolbarActions, panel }: EntryTableProps) {
  const tableScroll = useTableScroll();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const pageSize = useListPageSize();
  const [selected, setSelected] = useState<Key[]>([]);
  const seedInputs = useRef(new Map<string, HTMLInputElement>());
  const { tableProps, searchFormProps, sorters, filters, setFilters, tableQuery } = useTable<EntryRecord>({
    resource: entriesResource(subEvent.id),
    syncWithLocation: false,
    pagination: { pageSize },
    sorters: { initial: [{ field: 'seed', order: 'asc' }] },
  });
  const rows = tableProps.dataSource ?? [];
  const total = typeof tableProps.pagination === 'object' ? (tableProps.pagination.total ?? rows.length) : rows.length;

  const reload = () => Promise.all([tableQuery.refetch(), onCountsChanged()]);
  const setStatus = async (entry: EntryRecord, status: EntryRecord['status']) => {
    const res = await apiFetch<EntryWriteResult<EntryRecord>>(`/admin/entries/${entry.id}`, { method: 'PATCH', body: { status } });
    message.success(status === 'WITHDRAWN' ? `Đã rút ${entry.competitor.displayName}` : `Đã khôi phục ${entry.competitor.displayName}`);
    showWarnings(message, res.warnings);
    await reload();
  };

  const moveSeedFocus = (entry: EntryRecord, backwards: boolean) => {
    const editable = rows.filter((row) => seedInputs.current.has(row.id));
    const next = editable[editable.findIndex((row) => row.id === entry.id) + (backwards ? -1 : 1)];
    if (!next) return false;
    seedInputs.current.get(next.id)?.focus();
    return true;
  };

  const filterFields: FilterFieldDef[] = [
    { kind: 'search', field: 'q', placeholder: 'Tìm theo tên, mã VĐV hoặc CLB' },
    { kind: 'select', field: 'status', placeholder: 'Trạng thái', options: ENTRY_STATUS_OPTIONS },
    ...(subEvent.hasQualifying ? [{ kind: 'select' as const, field: 'stage', placeholder: 'Vòng', options: ENTRY_STAGE_OPTIONS }] : []),
    { kind: 'select', field: 'quotaType', placeholder: 'Suất', options: QUOTA_OPTIONS },
  ];

  return (
    <Flex vertical gap="middle">
      <Flex justify="space-between" align="start" wrap gap="small">
        <ListFilterBar searchForm={searchFormProps.form} filters={filters} setFilters={setFilters} fields={filterFields} />
        {toolbarActions}
      </Flex>
      {panel}
      {selected.length > 0 && (
        <EntryBulkBar
          ids={selected.map(String)}
          hasQualifying={subEvent.hasQualifying}
          onClear={() => setSelected([])}
          onDone={async () => {
            setSelected([]);
            await reload();
          }}
        />
      )}
      <Card title={`Danh sách hiện có · ${total} ${entryUnit(subEvent.discipline.competitorKind)}`} styles={{ body: { padding: 0 } }}>
        <Table<EntryRecord>
          {...tableProps}
          rowKey="id"
          scroll={tableScroll}
          size="small"
          columns={entryColumns({
            subEvent,
            canUpdate,
            sorters,
            registerSeedInput: (id, element) => (element ? seedInputs.current.set(id, element) : seedInputs.current.delete(id)),
            moveSeedFocus,
            setStatus,
            onError: (error) => message.error(error instanceof ApiError ? error.message : 'Không thực hiện được'),
          })}
          rowSelection={canUpdate ? { selectedRowKeys: selected, onChange: setSelected, preserveSelectedRowKeys: true } : undefined}
          onRow={(entry) => ({ style: entry.status === 'WITHDRAWN' ? { color: token.colorTextTertiary } : undefined })}
        />
      </Card>
    </Flex>
  );
}

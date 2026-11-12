import { getDefaultSortOrder, useTable } from '@refinedev/antd';
import { App, Button, Flex, Space, Table, Tag, Tooltip, Typography, theme } from 'antd';
import { useRef, useState, type Key } from 'react';
import { Link } from 'react-router';
import { ApiError, apiFetch } from '../../api/http-client';
import { ConfirmActionButton } from '../../components/confirm-action-button';
import { ListFilterBar, type FilterFieldDef } from '../../components/list-filter-bar';
import { useListPageSize } from '../../providers/use-list-page-size';
import { EntryBulkBar } from './entry-bulk-bar';
import {
  ENTRY_STAGE_LABELS,
  ENTRY_STAGE_OPTIONS,
  ENTRY_STATUS_LABELS,
  ENTRY_STATUS_OPTIONS,
  QUOTA_LABELS,
  QUOTA_OPTIONS,
  showWarnings,
  type EntryRecord,
  type EntrySubEvent,
  type EntryWriteResult,
} from './entry-labels';
import { EntrySeedCell } from './entry-seed-cell';

export const entriesResource = (subEventId: string) => `sub-events/${subEventId}/entries`;

interface EntryTableProps {
  subEvent: EntrySubEvent;
  canUpdate: boolean;
  /** Counts in the side menu change with every status write. */
  onCountsChanged: () => Promise<unknown>;
}

export function EntryTable({ subEvent, canUpdate, onCountsChanged }: EntryTableProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const pageSize = useListPageSize();
  const [selected, setSelected] = useState<Key[]>([]);
  const seedInputs = useRef(new Map<string, HTMLInputElement>());
  const { tableProps, sorters, filters, setFilters, tableQuery } = useTable<EntryRecord>({
    resource: entriesResource(subEvent.id),
    syncWithLocation: false,
    pagination: { pageSize },
    sorters: { initial: [{ field: 'seed', order: 'asc' }] },
  });
  const rows = tableProps.dataSource ?? [];

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
    { kind: 'search', field: 'q', placeholder: 'Tìm theo tên hoặc mã VĐV' },
    { kind: 'select', field: 'status', placeholder: 'Trạng thái', options: ENTRY_STATUS_OPTIONS },
    ...(subEvent.hasQualifying ? [{ kind: 'select' as const, field: 'stage', placeholder: 'Vòng', options: ENTRY_STAGE_OPTIONS }] : []),
    { kind: 'select', field: 'quotaType', placeholder: 'Suất', options: QUOTA_OPTIONS },
  ];

  return (
    <Flex vertical gap="middle">
      <ListFilterBar filters={filters} setFilters={setFilters} fields={filterFields} />
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
      <Table<EntryRecord>
        {...tableProps}
        rowKey="id"
        size="small"
        rowSelection={canUpdate ? { selectedRowKeys: selected, onChange: setSelected, preserveSelectedRowKeys: true } : undefined}
        onRow={(entry) => ({ style: entry.status === 'WITHDRAWN' ? { color: token.colorTextTertiary } : undefined })}
      >
        <Table.Column<EntryRecord>
          dataIndex="seed"
          title="Hạt giống"
          sorter
          defaultSortOrder={getDefaultSortOrder('seed', sorters)}
          render={(seed: number | null, entry) =>
            canUpdate && entry.status === 'CONFIRMED' ? (
              <EntrySeedCell
                entry={entry}
                register={(element) => (element ? seedInputs.current.set(entry.id, element) : seedInputs.current.delete(entry.id))}
                onTab={(backwards) => moveSeedFocus(entry, backwards)}
              />
            ) : (
              (seed ?? '—')
            )
          }
        />
        <Table.Column<EntryRecord>
          key="displayName"
          dataIndex={['competitor', 'displayName']}
          title={subEvent.discipline.competitorKind === 'DOUBLES' ? 'Cặp' : 'VĐV'}
          sorter
          defaultSortOrder={getDefaultSortOrder('displayName', sorters)}
          render={(_, entry) => (
            <Flex vertical>
              {entry.competitor.players.map((player) => (
                <span key={player.id}>
                  <Link to={`/players/${player.id}/edit`} style={entry.status === 'WITHDRAWN' ? { color: 'inherit' } : undefined}>
                    {player.fullName}
                  </Link>{' '}
                  <Typography.Text type="secondary">
                    {[player.code, player.club, player.birthYear].filter(Boolean).join(' · ')}
                  </Typography.Text>
                </span>
              ))}
            </Flex>
          )}
        />
        {subEvent.hasQualifying && (
          <Table.Column<EntryRecord>
            dataIndex="stage"
            title="Vòng"
            render={(stage: EntryRecord['stage']) => <Tag color={stage === 'QUALIFYING' ? 'purple' : undefined}>{ENTRY_STAGE_LABELS[stage]}</Tag>}
          />
        )}
        <Table.Column<EntryRecord>
          dataIndex="quotaType"
          title="Suất"
          render={(quota: EntryRecord['quotaType']) => <Tag color={quota === 'DIRECT' ? undefined : 'blue'}>{QUOTA_LABELS[quota]}</Tag>}
        />
        <Table.Column<EntryRecord>
          dataIndex="status"
          title="Trạng thái"
          render={(status: EntryRecord['status'], entry) => (
            <Space size="small" wrap>
              <Tag color={status === 'CONFIRMED' ? 'green' : undefined}>{ENTRY_STATUS_LABELS[status]}</Tag>
              {entry.eligibilityOverrideReason && (
                <Tooltip title={`Lý do ghi đè: ${entry.eligibilityOverrideReason}`}>
                  <Tag color="orange">Ghi đè</Tag>
                </Tooltip>
              )}
            </Space>
          )}
        />
        <Table.Column<EntryRecord> dataIndex="notes" title="Ghi chú" render={(notes: string | null) => notes ?? '—'} />
        {canUpdate && (
          <Table.Column<EntryRecord>
            key="actions"
            title="Thao tác"
            render={(_, entry) =>
              entry.status === 'CONFIRMED' ? (
                <ConfirmActionButton
                  label="Rút"
                  title={`Rút ${entry.competitor.displayName}?`}
                  content="Đăng ký vẫn nằm trong danh sách (hiện mờ) và khôi phục được."
                  okText="Rút"
                  danger
                  buttonProps={{ size: 'small' }}
                  onConfirm={() => setStatus(entry, 'WITHDRAWN')}
                />
              ) : (
                <Button size="small" onClick={() => void setStatus(entry, 'CONFIRMED').catch((error: unknown) => message.error(error instanceof ApiError ? error.message : 'Không thực hiện được'))}>
                  Khôi phục
                </Button>
              )
            }
          />
        )}
      </Table>
    </Flex>
  );
}

import { getDefaultSortOrder, List, useSelect, useTable } from '@refinedev/antd';
import { Descriptions, Table, Typography } from 'antd';
import dayjs from 'dayjs';
import { ListFilterBar } from '../../components/list-filter-bar';
import { useListPageSize } from '../../providers/use-list-page-size';
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS, type AuditLogRecord, toOptions } from './audit-log-labels';
import { useTableScroll } from '../../components/use-table-scroll';

const json = (value: unknown) => (value === null || value === undefined ? '—' : JSON.stringify(value, null, 2));

/** Read-only: no create, edit or delete exists for audit rows. */
export function AuditLogList() {
  const tableScroll = useTableScroll();
  const pageSize = useListPageSize();
  const { tableProps, sorters, filters, setFilters } = useTable<AuditLogRecord>({
    resource: 'audit-logs',
    syncWithLocation: true,
    pagination: { pageSize },
    sorters: { initial: [{ field: 'createdAt', order: 'desc' }] },
  });
  const { selectProps: actorSelect } = useSelect<{ id: string; name: string }>({
    resource: 'users',
    optionLabel: 'name',
    optionValue: 'id',
    onSearch: (value) => [{ field: 'q', operator: 'contains', value }],
    pagination: { pageSize },
  });

  return (
    <List title="Nhật ký thao tác">
      <ListFilterBar
        filters={filters}
        setFilters={setFilters}
        fields={[
          {
            kind: 'select',
            field: 'actorId',
            placeholder: 'Người thực hiện',
            options: (actorSelect.options ?? []) as { value: string; label: string }[],
            showSearch: true,
            onSearch: actorSelect.onSearch,
          },
          { kind: 'select', field: 'entity', placeholder: 'Đối tượng', options: toOptions(AUDIT_ENTITY_LABELS) },
          { kind: 'select', field: 'action', placeholder: 'Hành động', options: toOptions(AUDIT_ACTION_LABELS) },
          { kind: 'dateRange', fromField: 'from', toField: 'to', placeholder: ['Từ ngày', 'Đến ngày'] },
        ]}
      />
      <Table
        {...tableProps}
        rowKey="id" scroll={tableScroll}
        expandable={{
          expandedRowRender: (row) => (
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Trước">
                <Typography.Text code style={{ whiteSpace: 'pre-wrap' }}>{json(row.before)}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Sau">
                <Typography.Text code style={{ whiteSpace: 'pre-wrap' }}>{json(row.after)}</Typography.Text>
              </Descriptions.Item>
              {row.reason && <Descriptions.Item label="Lý do">{row.reason}</Descriptions.Item>}
            </Descriptions>
          ),
        }}
      >
        <Table.Column<AuditLogRecord>
          dataIndex="createdAt"
          title="Thời gian"
          sorter
          defaultSortOrder={getDefaultSortOrder('createdAt', sorters)}
          render={(value: string) => dayjs(value).format('HH:mm:ss DD/MM/YYYY')}
        />
        <Table.Column<AuditLogRecord>
          key="actor"
          title="Người thực hiện"
          render={(_, row) => (row.actorType === 'SYSTEM' ? 'Hệ thống' : (row.actorName ?? row.actorId))}
        />
        <Table.Column<AuditLogRecord>
          dataIndex="action"
          title="Hành động"
          render={(action: string) => AUDIT_ACTION_LABELS[action] ?? action}
        />
        <Table.Column<AuditLogRecord>
          key="entity"
          title="Đối tượng"
          render={(_, row) => `${AUDIT_ENTITY_LABELS[row.entity] ?? row.entity} · ${row.entityId}`}
        />
        <Table.Column<AuditLogRecord> dataIndex="ip" title="IP" render={(ip: string | null) => ip ?? '—'} />
      </Table>
    </List>
  );
}

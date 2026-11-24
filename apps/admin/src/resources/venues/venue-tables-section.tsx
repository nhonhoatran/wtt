import { getDefaultSortOrder, useTable } from '@refinedev/antd';
import { App, Button, Card, Space, Switch, Table, theme } from 'antd';
import { useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { ConfirmActionButton } from '../../components/confirm-action-button';
import { useListPageSize } from '../../providers/use-list-page-size';
import { useCatalogAccess } from '../catalog-common/catalog-access';
import { BulkTablesModal, TableFormModal, type VenueTableRecord } from './venue-table-modals';
import { useTableScroll } from '../../components/use-table-scroll';

type Dialog = { kind: 'form'; table: VenueTableRecord | null } | { kind: 'bulk' } | null;

/** "Bàn thi đấu" on the venue edit page: server-paged table plus add / quick-create dialogs. */
export function VenueTablesSection({ venueId }: { venueId: string }) {
  const tableScroll = useTableScroll();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { canCreate, canUpdate, canDelete } = useCatalogAccess();
  const pageSize = useListPageSize();
  const [dialog, setDialog] = useState<Dialog>(null);
  const { tableProps, sorters, tableQuery } = useTable<VenueTableRecord>({
    resource: `venues/${venueId}/tables`,
    syncWithLocation: false,
    pagination: { pageSize },
    sorters: { initial: [{ field: 'order', order: 'asc' }] },
  });
  const base = `/admin/venues/${venueId}/tables`;
  const reload = () => void tableQuery.refetch();

  const setActive = async (table: VenueTableRecord, isActive: boolean) => {
    try {
      await apiFetch(`${base}/${table.id}`, { method: 'PATCH', body: { isActive } });
      reload();
      message.success(isActive ? `Đã hiện lại bàn ${table.code}` : `Đã ẩn bàn ${table.code}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không lưu được');
    }
  };

  return (
    <Card
      title="Bàn thi đấu"
      style={{ marginTop: token.marginLG }}
      extra={
        canCreate && (
          <Space>
            <Button onClick={() => setDialog({ kind: 'bulk' })}>Tạo nhanh nhiều bàn</Button>
            <Button type="primary" onClick={() => setDialog({ kind: 'form', table: null })}>Thêm bàn</Button>
          </Space>
        )
      }
    >
      <Table {...tableProps} rowKey="id" size="small" scroll={tableScroll}>
        <Table.Column<VenueTableRecord> dataIndex="order" title="Thứ tự" sorter defaultSortOrder={getDefaultSortOrder('order', sorters)} />
        <Table.Column<VenueTableRecord> dataIndex="code" title="Mã bàn" sorter defaultSortOrder={getDefaultSortOrder('code', sorters)} />
        <Table.Column<VenueTableRecord> dataIndex="displayName" title="Tên hiển thị" render={(name: string | null) => name ?? '—'} />
        <Table.Column<VenueTableRecord>
          key="active"
          title="Hiển thị"
          render={(_, table) => (
            <Switch size="small" checked={table.isActive} disabled={!canUpdate} aria-label={`Hiển thị bàn ${table.code}`} onChange={(checked) => void setActive(table, checked)} />
          )}
        />
        <Table.Column<VenueTableRecord>
          key="actions"
          title="Thao tác"
          render={(_, table) => (
            <Space size="small">
              {canUpdate && <Button size="small" onClick={() => setDialog({ kind: 'form', table })}>Sửa</Button>}
              {canDelete && (
                <ConfirmActionButton
                  label="Xóa"
                  title={`Xóa bàn ${table.code}?`}
                  okText="Xóa"
                  danger
                  buttonProps={{ size: 'small' }}
                  onConfirm={async () => {
                    await apiFetch(`${base}/${table.id}`, { method: 'DELETE' });
                    reload();
                    message.success(`Đã xóa bàn ${table.code}`);
                  }}
                  onHide={() => setActive(table, false)}
                />
              )}
            </Space>
          )}
        />
      </Table>
      {dialog?.kind === 'form' && (
        <TableFormModal venueId={venueId} table={dialog.table} onClose={() => setDialog(null)} onDone={() => { setDialog(null); reload(); }} />
      )}
      {dialog?.kind === 'bulk' && (
        <BulkTablesModal venueId={venueId} onClose={() => setDialog(null)} onDone={() => { setDialog(null); reload(); }} />
      )}
    </Card>
  );
}

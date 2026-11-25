import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Empty, Result, Skeleton, Table, Typography } from 'antd';
import { useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { showWarnings, warningsOf } from '../../api/write-warnings';
import { useTableScroll } from '../../components/use-table-scroll';
import { BulkSubEventModal } from './bulk-sub-event-modal';
import { drawsOverviewKey } from './draw-labels';
import type { DrawOverviewRow } from './draw-types';
import { entryCountsKey, type EntryCount } from './entry-labels';
import type { HubTabContext } from './hub-tab-context';
import { subEventColumns } from './sub-event-columns';
import { SubEventEditModal } from './sub-event-edit-modal';
import { subEventsKey, type SubEventRecord } from './sub-event-labels';

export function SubEventsTab({ event, canCreate, canUpdate, canDelete, onChanged }: HubTabContext) {
  const tableScroll = useTableScroll();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<SubEventRecord | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: subEventsKey(event.id),
    queryFn: async () => (await apiFetch<{ data: SubEventRecord[] }>(`/admin/events/${event.id}/sub-events`)).data,
  });
  // Same keys as the entries and draws tabs, so the cache is shared between tabs.
  const counts = useQuery({
    queryKey: entryCountsKey(event.id),
    queryFn: async () => (await apiFetch<{ data: EntryCount[] }>(`/admin/events/${event.id}/entry-counts`)).data,
  });
  const overview = useQuery({
    queryKey: drawsOverviewKey(event.id),
    queryFn: async () => (await apiFetch<{ data: DrawOverviewRow[] }>(`/admin/events/${event.id}/draws`)).data,
  });

  if (isLoading) return <Skeleton active />;
  if (isError || !data) {
    return <Result status="error" title="Không tải được nội dung thi đấu" extra={<Button onClick={() => refetch()}>Thử lại</Button>} />;
  }

  const refresh = () =>
    Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: entryCountsKey(event.id) }),
      queryClient.invalidateQueries({ queryKey: drawsOverviewKey(event.id) }),
      onChanged(),
    ]);
  const remove = (row: SubEventRecord) => async () => {
    const response = await apiFetch(`/admin/events/${event.id}/sub-events/${row.id}`, { method: 'DELETE' });
    await refresh();
    message.success('Đã xóa nội dung');
    showWarnings(message, warningsOf(response));
  };
  const addButton = canCreate && (
    <Button type={data.length === 0 ? 'primary' : 'default'} icon={<PlusOutlined />} onClick={() => setBulkOpen(true)}>
      Thêm nội dung
    </Button>
  );

  return (
    <Card title={`${data.length} nội dung thi đấu`} extra={data.length > 0 ? addButton : null}>
      <Table<SubEventRecord>
        dataSource={data}
        rowKey="id"
        scroll={tableScroll}
        pagination={false}
        columns={subEventColumns({
          eventId: event.id,
          counts: counts.data,
          overview: overview.data,
          published: event.publishStatus === 'PUBLISHED',
          canUpdate,
          canDelete,
          onEdit: setEditing,
          onRemove: remove,
        })}
        locale={{ emptyText: <Empty description="Chưa có nội dung">{addButton || null}</Empty> }}
      />
      {data.length > 0 && (
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          Bấm số VĐV/cặp để xem danh sách đăng ký, bấm trạng thái bốc thăm để mở tab Bốc thăm của nội dung đó.
        </Typography.Paragraph>
      )}
      <BulkSubEventModal eventId={event.id} open={bulkOpen} onClose={() => setBulkOpen(false)} onCreated={refresh} />
      <SubEventEditModal eventId={event.id} subEvent={editing} onClose={() => setEditing(null)} onSaved={refresh} />
    </Card>
  );
}

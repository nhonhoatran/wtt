import { PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { App, Button, Empty, Flex, Result, Skeleton, Space, Table, Tag, Tooltip } from 'antd';
import { useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { ConfirmActionButton } from '../../components/confirm-action-button';
import { BulkSubEventModal } from './bulk-sub-event-modal';
import type { HubTabContext } from './hub-tab-context';
import { SubEventEditModal } from './sub-event-edit-modal';
import { SUB_EVENT_FORMAT_LABELS, subEventsKey, subEventTitle, type SubEventRecord } from './sub-event-labels';

export function SubEventsTab({ event, canCreate, canUpdate, canDelete, onChanged }: HubTabContext) {
  const { message } = App.useApp();
  const [bulkOpen, setBulkOpen] = useState(false);
  const published = event.publishStatus === 'PUBLISHED';
  const [editing, setEditing] = useState<SubEventRecord | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: subEventsKey(event.id),
    queryFn: async () => (await apiFetch<{ data: SubEventRecord[] }>(`/admin/events/${event.id}/sub-events`)).data,
  });

  if (isLoading) return <Skeleton active />;
  if (isError || !data) {
    return <Result status="error" title="Không tải được nội dung thi đấu" extra={<Button onClick={() => refetch()}>Thử lại</Button>} />;
  }

  const refresh = () => Promise.all([refetch(), onChanged()]);
  const remove = (row: SubEventRecord) => async () => {
    await apiFetch(`/admin/events/${event.id}/sub-events/${row.id}`, { method: 'DELETE' });
    await refresh();
    message.success('Đã xóa nội dung');
  };
  const addButton = canCreate && (
    <Button type="primary" icon={<PlusOutlined />} onClick={() => setBulkOpen(true)}>
      Thêm nội dung
    </Button>
  );

  return (
    <Flex vertical gap="middle">
      {data.length > 0 && addButton && <Flex justify="end">{addButton}</Flex>}
      <Table<SubEventRecord>
        dataSource={data}
        rowKey="id"
        pagination={false}
        locale={{ emptyText: <Empty description="Chưa có nội dung">{addButton || null}</Empty> }}
      >
        <Table.Column<SubEventRecord> title="Nội dung" render={(_, row) => subEventTitle(row)} />
        <Table.Column<SubEventRecord> dataIndex="code" title="Mã" render={(code: string) => <Tag>{code}</Tag>} />
        <Table.Column<SubEventRecord> dataIndex="format" title="Thể thức" render={(format: SubEventRecord['format']) => SUB_EVENT_FORMAT_LABELS[format]} />
        <Table.Column<SubEventRecord> title="Thể thức trận" render={(_, row) => row.matchFormat.name} />
        <Table.Column<SubEventRecord> title="Luật tính điểm bảng" render={(_, row) => row.groupScoringRule?.name ?? '—'} />
        <Table.Column<SubEventRecord> dataIndex="maxEntries" title="Tối đa" align="right" render={(value: number | null) => value ?? '—'} />
        {(canUpdate || canDelete) && (
          <Table.Column<SubEventRecord>
            title="Thao tác"
            render={(_, row) => (
              <Space>
                {canUpdate && (
                  <Button size="small" onClick={() => setEditing(row)}>
                    Sửa
                  </Button>
                )}
                {canDelete && (
                  <Tooltip title={published ? 'Bỏ công bố giải trước khi xóa nội dung' : undefined}>
                    <span>
                      <ConfirmActionButton
                        label="Xóa"
                        title={`Xóa nội dung ${subEventTitle(row)}?`}
                        okText="Xóa"
                        danger
                        buttonProps={{ size: 'small', disabled: published }}
                        onConfirm={remove(row)}
                      />
                    </span>
                  </Tooltip>
                )}
              </Space>
            )}
          />
        )}
      </Table>
      <BulkSubEventModal eventId={event.id} open={bulkOpen} onClose={() => setBulkOpen(false)} onCreated={refresh} />
      <SubEventEditModal eventId={event.id} subEvent={editing} onClose={() => setEditing(null)} onSaved={refresh} />
    </Flex>
  );
}

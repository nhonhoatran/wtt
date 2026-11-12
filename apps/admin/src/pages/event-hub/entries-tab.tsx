import { DownloadOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useCan, useInvalidate } from '@refinedev/core';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Empty, Flex, Result, Skeleton, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { apiUrl } from '../../api/api-url';
import { apiFetch } from '../../api/http-client';
import { ImportWizard } from '../../components/import-wizard';
import { AddEntryForm } from './add-entry-form';
import { entryCountsKey, SIDE_MENU_WIDTH, SUB_EVENT_QUERY_PARAM, type EntryCount, type EntrySubEvent } from './entry-labels';
import { entriesResource, EntryTable } from './entry-table';
import type { HubTabContext } from './hub-tab-context';
import { subEventsKey, subEventTitle } from './sub-event-labels';
import { SubEventSideMenu } from './sub-event-side-menu';

/** "Danh sách" tab: pick a sub-event on the left, manage its entries on the right; the pick stays in ?subEvent=. */
export function EntriesTab({ event, canCreate, canUpdate }: HubTabContext) {
  const [params, setParams] = useSearchParams();
  const invalidate = useInvalidate();
  const canOverride = useCan({ resource: 'tournaments', action: 'manage' }).data?.can ?? false;
  const [importOpen, setImportOpen] = useState(false);
  const subEvents = useQuery({
    queryKey: subEventsKey(event.id),
    queryFn: async () => (await apiFetch<{ data: EntrySubEvent[] }>(`/admin/events/${event.id}/sub-events`)).data,
  });
  const counts = useQuery({
    queryKey: entryCountsKey(event.id),
    queryFn: async () => (await apiFetch<{ data: EntryCount[] }>(`/admin/events/${event.id}/entry-counts`)).data,
  });

  if (subEvents.isLoading) return <Skeleton active />;
  if (subEvents.isError || !subEvents.data) {
    return <Result status="error" title="Không tải được nội dung thi đấu" extra={<Button onClick={() => subEvents.refetch()}>Thử lại</Button>} />;
  }
  if (subEvents.data.length === 0) {
    return (
      <Empty description="Chưa có nội dung">
        {canCreate && (
          <Link to={`/events/${event.id}/sub-events`}>
            <Button type="primary" icon={<PlusOutlined />}>
              Thêm nội dung
            </Button>
          </Link>
        )}
      </Empty>
    );
  }

  const selected = subEvents.data.find((row) => row.id === params.get(SUB_EVENT_QUERY_PARAM)) ?? subEvents.data[0]!;
  const select = (id: string) =>
    setParams((current) => {
      current.set(SUB_EVENT_QUERY_PARAM, id);
      return current;
    });
  const refreshCounts = () => counts.refetch();
  const onAdded = () => Promise.all([invalidate({ resource: entriesResource(selected.id), invalidates: ['list'] }), refreshCounts()]);
  const exportHref = apiUrl(`/admin/exports/entries?${new URLSearchParams({ eventId: event.id, subEventId: selected.id })}`);

  return (
    <Flex gap="middle" align="start">
      <div style={{ width: SIDE_MENU_WIDTH, flex: 'none' }}>
        <SubEventSideMenu subEvents={subEvents.data} counts={counts.data ?? []} selectedId={selected.id} onSelect={select} />
      </div>
      <Flex vertical gap="middle" style={{ flex: 1, minWidth: 0 }}>
        <Flex justify="space-between" align="center" wrap gap="small">
          <Space align="center" wrap>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {subEventTitle(selected)}
            </Typography.Title>
            <Tag>{selected.code}</Tag>
          </Space>
          <Space wrap>
            {canCreate && (
              <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
                Import Excel
              </Button>
            )}
            <Button icon={<DownloadOutlined />} href={exportHref}>
              Xuất Excel
            </Button>
          </Space>
        </Flex>
        {counts.isError && (
          <Alert type="warning" showIcon message="Không tải được số đăng ký của từng nội dung." action={<Button size="small" onClick={() => counts.refetch()}>Thử lại</Button>} />
        )}
        {canCreate && <AddEntryForm key={selected.id} subEvent={selected} canOverride={canOverride} onAdded={onAdded} />}
        <EntryTable key={selected.id} subEvent={selected} canUpdate={canUpdate} onCountsChanged={refreshCounts} />
      </Flex>
      <ImportWizard eventId={event.id} open={importOpen} onClose={() => setImportOpen(false)} />
    </Flex>
  );
}

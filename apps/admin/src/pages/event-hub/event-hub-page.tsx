import { ArrowLeftOutlined } from '@ant-design/icons';
import { EVENT_LIFECYCLE_LABELS } from '@kamito/shared';
import { useCan, useInvalidate } from '@refinedev/core';
import { useQuery } from '@tanstack/react-query';
import { Button, Flex, Result, Skeleton, Tabs, Tag, Typography } from 'antd';
import { useCallback, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError, apiFetch } from '../../api/http-client';
import {
  formatDateRange,
  LIFECYCLE_COLORS,
  PUBLISH_LABELS,
  type EventRecord,
} from '../../resources/events/event-labels';
import { DrawsTab } from './draws-tab';
import { EntriesTab } from './entries-tab';
import { EventHubActions } from './event-hub-actions';
import { EventInfoTab } from './event-info-tab';
import type { HubTabContext } from './hub-tab-context';
import { ScheduleTab } from './schedule-tab';
import { SubEventsTab } from './sub-events-tab';
import { SponsorsTab } from './sponsors-tab';

interface HubTabDef {
  key: string;
  label: string;
  render: (context: HubTabContext) => ReactNode;
}

/** Later phases append their tabs here (lịch đấu...). */
const HUB_TABS: HubTabDef[] = [
  { key: 'info', label: 'Thông tin', render: (context) => <EventInfoTab {...context} /> },
  { key: 'sub-events', label: 'Nội dung thi đấu', render: (context) => <SubEventsTab {...context} /> },
  { key: 'entries', label: 'Danh sách', render: (context) => <EntriesTab {...context} /> },
  { key: 'draws', label: 'Bốc thăm', render: (context) => <DrawsTab {...context} /> },
  { key: 'schedule', label: 'Lịch & kết quả', render: (context) => <ScheduleTab {...context} /> },
  { key: 'sponsors', label: 'Tài trợ', render: (context) => <SponsorsTab {...context} /> },
];
const DEFAULT_TAB = HUB_TABS[0]!.key;

export function EventHubPage() {
  const { id = '', tab } = useParams();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const canUpdate = useCan({ resource: 'tournaments', action: 'update' }).data?.can ?? false;
  const canCreate = useCan({ resource: 'tournaments', action: 'create' }).data?.can ?? false;
  const canDelete = useCan({ resource: 'tournaments', action: 'delete' }).data?.can ?? false;
  const canPublish = useCan({ resource: 'tournaments', action: 'publish' }).data?.can ?? false;
  const canListSponsors = useCan({ resource: 'sponsors', action: 'list' }).data?.can ?? false;
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-event', id],
    queryFn: async () => (await apiFetch<{ data: EventRecord }>(`/admin/events/${encodeURIComponent(id)}`)).data,
    retry: false,
  });

  const onChanged = useCallback(async () => {
    await Promise.all([refetch(), invalidate({ resource: 'events', invalidates: ['list'] })]);
  }, [refetch, invalidate]);

  if (isLoading) return <Skeleton active />;
  if (error || !data) {
    const notFound = error instanceof ApiError && error.statusCode === 404;
    return (
      <Result
        status={notFound ? '404' : 'error'}
        title={notFound ? 'Không tìm thấy giải' : 'Không tải được giải'}
        extra={
          notFound ? (
            <Link to="/events">
              <Button type="primary">Về danh sách giải</Button>
            </Link>
          ) : (
            <Button onClick={() => refetch()}>Thử lại</Button>
          )
        }
      />
    );
  }

  const tabs = HUB_TABS.filter((item) => item.key !== 'sponsors' || canListSponsors);
  const activeKey = tabs.some((item) => item.key === tab) ? tab : DEFAULT_TAB;
  const context: HubTabContext = { event: data, canUpdate, canCreate, canDelete, onChanged };

  return (
    <Flex vertical gap="middle">
      <Link to="/events">
        <ArrowLeftOutlined /> Danh sách giải
      </Link>
      <Flex justify="space-between" align="start" wrap gap="middle">
        <Flex vertical gap="small">
          <Typography.Title level={3} style={{ margin: 0 }}>{data.name}</Typography.Title>
          <Flex gap="small" align="center" wrap>
            <Tag color={LIFECYCLE_COLORS[data.lifecycle]}>{EVENT_LIFECYCLE_LABELS[data.lifecycle]}</Tag>
            <Tag color={data.publishStatus === 'PUBLISHED' ? 'green' : undefined}>{PUBLISH_LABELS[data.publishStatus]}</Tag>
            <Typography.Text type="secondary">{formatDateRange(data)}</Typography.Text>
          </Flex>
        </Flex>
        <EventHubActions event={data} canUpdate={canUpdate} canPublish={canPublish} onChanged={onChanged} />
      </Flex>
      <Tabs
        activeKey={activeKey}
        onChange={(key) => navigate(`/events/${data.id}/${key}`)}
        items={tabs.map((item) => ({ key: item.key, label: item.label, children: item.render(context) }))}
      />
    </Flex>
  );
}

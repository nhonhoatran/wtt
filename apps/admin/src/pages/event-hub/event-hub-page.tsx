import { useCan, useInvalidate } from '@refinedev/core';
import { useQuery } from '@tanstack/react-query';
import { Button, Flex, Result, Skeleton, Tabs } from 'antd';
import { useCallback, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError, apiFetch } from '../../api/http-client';
import { useBreadcrumbTail } from '../../layout/admin-breadcrumb';
import type { EventRecord } from '../../resources/events/event-labels';
import { DrawsTab } from './draws-tab';
import { EntriesTab } from './entries-tab';
import { EventHubActions } from './event-hub-actions';
import { EventHubHeader } from './event-hub-header';
import { EventProgressStepper } from './event-progress-stepper';
import { EventInfoTab } from './event-info-tab';
import type { HubTabContext } from './hub-tab-context';
import { ScheduleTab } from './schedule-tab';
import { SubEventsTab } from './sub-events-tab';
import { SponsorsTab } from './sponsors-tab';
import { useEventProgress } from './use-event-progress';

interface HubTabDef {
  key: string;
  label: string;
  render: (context: HubTabContext) => ReactNode;
}

/** Later phases append their tabs here (kết quả...). */
const HUB_TABS: HubTabDef[] = [
  { key: 'info', label: 'Thông tin', render: (context) => <EventInfoTab {...context} /> },
  { key: 'sub-events', label: 'Nội dung thi đấu', render: (context) => <SubEventsTab {...context} /> },
  { key: 'entries', label: 'Danh sách đăng ký', render: (context) => <EntriesTab {...context} /> },
  { key: 'draws', label: 'Bốc thăm', render: (context) => <DrawsTab {...context} /> },
  { key: 'schedule', label: 'Lịch thi đấu', render: (context) => <ScheduleTab {...context} /> },
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

  const progress = useEventProgress(id);
  const refetchProgress = progress.refetch;
  useBreadcrumbTail(data?.name);

  const onChanged = useCallback(async () => {
    await Promise.all([refetch(), refetchProgress(), invalidate({ resource: 'events', invalidates: ['list'] })]);
  }, [refetch, refetchProgress, invalidate]);

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
  const activeKey = tabs.find((item) => item.key === tab)?.key ?? DEFAULT_TAB;
  const context: HubTabContext = { event: data, canUpdate, canCreate, canDelete, onChanged };

  return (
    <Flex vertical gap="middle">
      <EventHubHeader
        event={data}
        progress={progress.data}
        actions={<EventHubActions event={data} activeTab={activeKey} canUpdate={canUpdate} canPublish={canPublish} onChanged={onChanged} />}
      />
      <EventProgressStepper eventId={data.id} progress={progress.data} loading={progress.isLoading} />
      <Tabs
        activeKey={activeKey}
        onChange={(key) => navigate(`/events/${data.id}/${key}`)}
        items={tabs.map((item) => ({ key: item.key, label: item.label, children: item.render(context) }))}
      />
    </Flex>
  );
}
